"use client";

import {
  AlertTriangleIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BUILD_STATUS_LABELS, OKR_STATUSES, OKR_STATUS_LABELS, type OkrStatus } from "@/lib/constants";
import { scoreColor } from "@/lib/score-color";
import { averageCredit, type CheckInSet } from "@/lib/streak";
import type { Build, Goal, Okr } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BUILD_STATUS_STYLES } from "@/components/builds/build-status";
import { GoalRow } from "./goal-row";
import { ROW_INSET, Section, StatChip } from "./layout";
import { MilestoneList } from "./milestone-list";
import { milestoneCounts } from "@/lib/milestones";

export const OKR_STATUS_STYLES: Record<OkrStatus, string> = {
  active: "bg-muted text-muted-foreground",
  success: "bg-[oklch(0.72_0.18_148/0.16)] text-[oklch(0.5_0.14_148)] dark:text-[oklch(0.8_0.15_148)]",
  missed: "bg-destructive/12 text-destructive",
};

type OkrCardProps = {
  okr: Okr;
  goals: Goal[];
  /** Builds linked to this OKR (link only; they don't affect scoring). */
  builds: Build[];
  checkIns: CheckInSet;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (status: OkrStatus) => void;
  onAddGoal: () => void;
  onEditGoal: (goal: Goal) => void;
  onDeleteGoal: (goal: Goal) => void;
  onChanged: () => Promise<void>;
  /** When shown in a modal: renders a close button at the end of the header actions. */
  onClose?: () => void;
  className?: string;
};

/**
 * Full OKR view. Every row (header lines, section headers, list items) shares
 * ROW_INSET inside one padded container, so all edges line up.
 */
export function OkrCard({
  okr,
  goals,
  builds,
  checkIns,
  today,
  onEdit,
  onDelete,
  onStatus,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onChanged,
  onClose,
  className,
}: OkrCardProps) {
  const avg = averageCredit(goals, checkIns, today);
  const avgColor = scoreColor(avg);
  const { done, failed, total } = milestoneCounts(okr.milestones);

  return (
    <article className={cn("flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-7", className)}>
      <header className={cn("flex flex-col gap-2.5", ROW_INSET)}>
        {/* Title · stats · actions */}
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 truncate text-xl leading-8 font-semibold tracking-[-0.02em]">{okr.title}</h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {avg !== null && (
              <StatChip
                value={`${Math.round(avg * 100)}%`}
                label="avg week"
                style={{ "--score": avgColor } as React.CSSProperties}
                className="score-text"
              />
            )}
            <StatChip value={`${done}/${total}`} label="milestones" />
            {failed > 0 && <StatChip value={failed} label="failed" className="text-destructive" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${okr.title}`} className="text-muted-foreground ml-1">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <PencilIcon /> Edit OKR
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onAddGoal}>
                  <PlusIcon /> Add goal
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2Icon /> Delete OKR
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {onClose && (
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose} className="text-muted-foreground">
                <XIcon />
              </Button>
            )}
          </div>
        </div>

        {/* Status · timeframe */}
        <div className="flex h-6 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-opacity hover:opacity-80",
                  OKR_STATUS_STYLES[okr.status],
                )}
              >
                {OKR_STATUS_LABELS[okr.status]}
                <ChevronDownIcon className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={okr.status} onValueChange={(v) => onStatus(v as OkrStatus)}>
                {OKR_STATUSES.map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {OKR_STATUS_LABELS[s]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {okr.timeframe && (
            <span className="text-muted-foreground border-border flex h-6 items-center rounded-full border px-2.5 text-[11px] font-medium">
              {okr.timeframe}
            </span>
          )}
        </div>

        {/* Description */}
        {okr.description && (
          <p className="text-muted-foreground text-sm leading-6 whitespace-pre-wrap">{okr.description}</p>
        )}
      </header>

      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Section label="Milestones">
            <MilestoneList
              okrId={okr.id}
              canFail={okr.timeframe !== null}
              milestones={okr.milestones}
              onChanged={onChanged}
            />
          </Section>

          {builds.length > 0 && (
            <Section label="Linked Builds">
              <ul className="flex flex-col">
                {builds.map((b) => (
                  <LinkedBuild key={b.id} build={b} />
                ))}
              </ul>
            </Section>
          )}
        </div>

        <Section
          label="Goals"
          action={
            <Button variant="ghost" size="xs" onClick={onAddGoal} className="text-muted-foreground">
              <PlusIcon /> Goal
            </Button>
          }
        >
          {goals.length === 0 ? (
            <div className="text-muted-foreground mx-2 flex items-start gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs">
              <AlertTriangleIcon className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>No goals yet. An OKR is made of one or more goals, so add one to start tracking it.</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {goals.map((g) => (
                <GoalRow
                  key={g.id}
                  goal={g}
                  checkIns={checkIns}
                  today={today}
                  onEdit={() => onEditGoal(g)}
                  onDelete={() => onDeleteGoal(g)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </article>
  );
}

/** A build linked to this OKR. Read-only here; it's edited from the Builds column. */
function LinkedBuild({ build }: { build: Build }) {
  return (
    <li className={cn("flex h-9 items-center gap-2.5", ROW_INSET)}>
      <span
        className={cn(
          "flex h-5 w-[4.75rem] shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
          BUILD_STATUS_STYLES[build.status],
        )}
      >
        {BUILD_STATUS_LABELS[build.status]}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{build.title}</span>
      {build.category && <span className="text-muted-foreground shrink-0 text-[11px]">{build.category}</span>}
    </li>
  );
}
