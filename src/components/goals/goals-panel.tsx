"use client";

import { useState } from "react";
import { AlertTriangleIcon, PlusIcon, TargetIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Panel, PanelEmpty, PanelLabel } from "@/components/workspace/panel";
import { api } from "@/lib/api-client";
import { OKR_STATUS_LABELS, type OkrStatus } from "@/lib/constants";
import { scoreColor } from "@/lib/score-color";
import { milestoneCounts } from "@/lib/milestones";
import { averageCredit, type CheckInSet } from "@/lib/streak";
import type { Goal, Okr, Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GoalDialog } from "./goal-dialog";
import { GoalRow } from "./goal-row";
import { OKR_STATUS_STYLES, OkrCard } from "./okr-card";
import { OkrDialog } from "./okr-dialog";

type GoalEditor = { goal: Goal | null; okrId: string | null } | null;
type Pending = { kind: "goal"; goal: Goal } | { kind: "okr"; okr: Okr } | null;

/** Recent-weeks dots per goal; the panel is narrow, the detail modal shows more. */
const PANEL_WEEKS = 6;

type GoalsPanelProps = {
  snapshot: Snapshot;
  checkIns: CheckInSet;
  reload: () => Promise<void>;
  onClose: () => void;
};

export function GoalsPanel({ snapshot, checkIns, reload, onClose }: GoalsPanelProps) {
  const { goals, okrs, today } = snapshot;

  const [goalEditor, setGoalEditor] = useState<GoalEditor>(null);
  const [okrEditor, setOkrEditor] = useState<{ okr: Okr | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Pending>(null);

  const detail = okrs.find((o) => o.id === detailId) ?? null;
  const unlinked = goals.filter((g) => g.okrId === null);
  const goalsOf = (okrId: string) => goals.filter((g) => g.okrId === okrId);
  const checkInCount = (goalId: string) => snapshot.checkIns.filter((c) => c.goalId === goalId).length;

  async function setStatus(okr: Okr, status: OkrStatus) {
    try {
      await api.updateOkr(okr.id, { status });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the status.");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === "goal") {
        await api.deleteGoal(pendingDelete.goal.id);
        toast.success(`Deleted “${pendingDelete.goal.title}”`);
      } else {
        await api.deleteOkr(pendingDelete.okr.id);
        setDetailId(null);
        toast.success(`Deleted “${pendingDelete.okr.title}”`);
      }
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  const goalRow = (g: Goal) => (
    <GoalRow
      key={g.id}
      goal={g}
      checkIns={checkIns}
      today={today}
      weeks={PANEL_WEEKS}
      onEdit={() => setGoalEditor({ goal: g, okrId: g.okrId })}
      onDelete={() => setPendingDelete({ kind: "goal", goal: g })}
    />
  );

  return (
    <Panel
      id="goals"
      width="w-[24rem]"
      onClose={onClose}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="New goal or OKR">
              <PlusIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setGoalEditor({ goal: null, okrId: null })}>New goal</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOkrEditor({ okr: null })}>New OKR</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {okrs.length === 0 && goals.length === 0 ? (
        <PanelEmpty icon={TargetIcon}>
          <p className="max-w-60">Start with an OKR, then add the weekly goals that get you there.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setGoalEditor({ goal: null, okrId: null })}>
              <PlusIcon /> Goal
            </Button>
            <Button size="sm" onClick={() => setOkrEditor({ okr: null })}>
              <PlusIcon /> OKR
            </Button>
          </div>
        </PanelEmpty>
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {okrs.map((okr) => (
            <OkrSummary
              key={okr.id}
              okr={okr}
              goals={goalsOf(okr.id)}
              checkIns={checkIns}
              today={today}
              onOpen={() => setDetailId(okr.id)}
              renderGoal={goalRow}
            />
          ))}

          {unlinked.length > 0 && (
            <section className="flex flex-col gap-1 pt-1">
              <PanelLabel className="px-2">Standalone goals</PanelLabel>
              <div className="flex flex-col">{unlinked.map(goalRow)}</div>
            </section>
          )}
        </div>
      )}

      {/* OKR detail: the full card with milestones and goal history. */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetailId(null)}>
        {detail && (
          <DialogContent
            showCloseButton={false}
            // Don't land focus (and a focus ring) on the first header button when opening.
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="max-h-[85dvh] gap-0 overflow-y-auto p-0 sm:max-w-4xl"
          >
            <DialogTitle className="sr-only">{detail.title}</DialogTitle>
            <OkrCard
              onClose={() => setDetailId(null)}
              okr={detail}
              goals={goalsOf(detail.id)}
              builds={snapshot.builds.filter((b) => b.okrId === detail.id)}
              checkIns={checkIns}
              today={today}
              onEdit={() => setOkrEditor({ okr: detail })}
              onDelete={() => setPendingDelete({ kind: "okr", okr: detail })}
              onStatus={(s) => void setStatus(detail, s)}
              onAddGoal={() => setGoalEditor({ goal: null, okrId: detail.id })}
              onEditGoal={(goal) => setGoalEditor({ goal, okrId: goal.okrId })}
              onDeleteGoal={(goal) => setPendingDelete({ kind: "goal", goal })}
              onChanged={reload}
            />
          </DialogContent>
        )}
      </Dialog>

      <GoalDialog
        open={goalEditor !== null}
        onOpenChange={(o) => !o && setGoalEditor(null)}
        goal={goalEditor?.goal ?? null}
        defaultOkrId={goalEditor?.okrId ?? null}
        okrs={okrs}
        today={today}
        onSaved={() => void reload()}
      />

      <OkrDialog
        open={okrEditor !== null}
        onOpenChange={(o) => !o && setOkrEditor(null)}
        okr={okrEditor?.okr ?? null}
        onSaved={() => void reload()}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={pendingDelete?.kind === "okr" ? "Delete this OKR?" : "Delete this goal?"}
        description={
          pendingDelete?.kind === "goal" ? (
            <>
              “{pendingDelete.goal.title}” and its {checkInCount(pendingDelete.goal.id)} check-ins will be permanently
              removed, and every week it was part of will be rescored without it.
            </>
          ) : pendingDelete?.kind === "okr" ? (
            <>
              “{pendingDelete.okr.title}” and its milestones will be permanently removed. Its goals and builds are kept
              and simply unlinked.
            </>
          ) : null
        }
        onConfirm={confirmDelete}
      />
    </Panel>
  );
}

function OkrSummary({
  okr,
  goals,
  checkIns,
  today,
  onOpen,
  renderGoal,
}: {
  okr: Okr;
  goals: Goal[];
  checkIns: CheckInSet;
  today: string;
  onOpen: () => void;
  renderGoal: (g: Goal) => React.ReactNode;
}) {
  const avg = averageCredit(goals, checkIns, today);
  const avgColor = scoreColor(avg);
  const { done, failed, total } = milestoneCounts(okr.milestones);

  return (
    <section className="border-border/70 rounded-xl border">
      <button
        type="button"
        onClick={onOpen}
        className="hover:bg-muted/40 flex w-full flex-col gap-1.5 rounded-t-xl px-3 pt-2.5 pb-2 text-left transition-colors outline-none focus-visible:bg-muted/40"
      >
        <span className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{okr.title}</span>
          {/* Average week score; hidden until there's a finished week to score. */}
          {avg !== null && (
            <span
              style={{ "--score": avgColor } as React.CSSProperties}
              className="tabular score-pill rounded-full px-1.5 py-px text-[11px] font-semibold"
              title="Average week"
            >
              {Math.round(avg * 100)}%
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", OKR_STATUS_STYLES[okr.status])}>
            {OKR_STATUS_LABELS[okr.status]}
          </span>
          {okr.timeframe && <span className="text-muted-foreground text-[11px]">{okr.timeframe}</span>}
          <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
            {done}/{total} milestones
            {failed > 0 && <span className="text-destructive"> · {failed} failed</span>}
          </span>
        </span>
        {total > 0 && (
          // Done, then failed, as two segments of one bar.
          <span className="bg-muted flex h-1 w-full overflow-hidden rounded-full">
            <span className="bg-foreground/60 h-full transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
            <span className="bg-destructive/60 h-full transition-[width]" style={{ width: `${(failed / total) * 100}%` }} />
          </span>
        )}
      </button>
      <div className="border-border/60 border-t px-1 py-1">
        {goals.length === 0 ? (
          <p className="text-muted-foreground flex items-center gap-1.5 px-2 py-1.5 text-[11px]">
            <AlertTriangleIcon className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
            No goals yet. Open it to add one.
          </p>
        ) : (
          goals.map(renderGoal)
        )}
      </div>
    </section>
  );
}
