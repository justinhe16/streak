"use client";

import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleXIcon,
  CornerDownRightIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  LockIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { formatDay } from "@/lib/dates";
import { flattenTree, isLocked, type MoveDirection } from "@/lib/milestones";
import type { MilestoneStatus } from "@/lib/constants";
import type { Milestone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ROW_INSET } from "./layout";

/** Indent per nesting level, and the deepest level that still indents further. */
const INDENT_STEP = 18;
const MAX_INDENT = 6;

type MilestoneListProps = {
  okrId: string;
  /** Failing is only offered on time-bound OKRs (ones with a timeframe). */
  canFail: boolean;
  milestones: Milestone[];
  onChanged: () => Promise<void>;
};

export function MilestoneList({ okrId, canFail, milestones, onChanged }: MilestoneListProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function run(action: () => Promise<unknown>, failure: string) {
    try {
      await action();
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failure);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await run(() => api.addMilestone(okrId, text), "Could not add the milestone.");
  }

  function setStatus(m: Milestone, status: MilestoneStatus) {
    void run(async () => {
      const { alsoFailed } = await api.updateMilestone(m.id, { status });
      if (alsoFailed > 0) {
        toast(`Also failed ${alsoFailed} milestone${alsoFailed === 1 ? "" : "s"} nested under it`);
      }
    }, "Could not update the milestone.");
  }

  function move(id: string, direction: MoveDirection) {
    void run(() => api.moveMilestone(id, direction), "Could not move the milestone.");
  }

  const rows = flattenTree(milestones);
  const byId = new Map(milestones.map((m) => [m.id, m]));

  async function commitEdit(m: Milestone) {
    const text = editText.trim();
    setEditingId(null);
    if (!text || text === m.text) return;
    await run(() => api.updateMilestone(m.id, { text }), "Could not rename the milestone.");
  }

  return (
    <div className="flex flex-col gap-0.5">
      {rows.map(({ milestone: m, depth, parent, index, siblingCount }) => {
        const locked = isLocked(m, byId);
        return (
          <div
            key={m.id}
            // Each level nests a step further (capped so long chains stay inside the column).
            style={{ paddingLeft: `calc(0.5rem + ${Math.min(depth, MAX_INDENT) * INDENT_STEP}px)` }}
            className={cn("group/ms hover:bg-muted/40 relative flex h-9 items-center gap-2 rounded-md", ROW_INSET)}
          >
            {depth > 0 && <CornerDownRightIcon className="text-muted-foreground/60 size-3.5 shrink-0" aria-hidden />}
            {locked ? (
              <span
                className="text-muted-foreground/70 grid size-4 shrink-0 place-items-center"
                title={`Needs “${parent?.text}” first`}
                aria-label={`${m.text}: locked until “${parent?.text}” is done`}
              >
                <LockIcon className="size-3.5" />
              </span>
            ) : m.status === "failed" ? (
              <button
                type="button"
                onClick={() => setStatus(m, "open")}
                title="Failed. Click to reopen"
                aria-label={`${m.text}: failed. Reopen`}
                className="text-destructive/80 hover:text-destructive grid size-4 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <CircleXIcon className="size-4" />
              </button>
            ) : (
              <Checkbox
                checked={m.status === "done"}
                onCheckedChange={(v) => setStatus(m, v === true ? "done" : "open")}
                aria-label={m.text}
              />
            )}
            {editingId === m.id ? (
              <Input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => void commitEdit(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitEdit(m);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="h-7 flex-1 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(m.id);
                  setEditText(m.text);
                }}
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-sm",
                  m.status === "done" && "text-muted-foreground line-through decoration-1",
                  m.status === "failed" && "text-muted-foreground decoration-destructive/60 line-through decoration-1",
                  locked && "text-muted-foreground",
                )}
                title="Click to edit"
              >
                {m.text}
              </button>
            )}
            {m.resolvedAt && (
              <span
                className={cn(
                  "shrink-0 text-[11px] tabular-nums",
                  m.status === "failed" ? "text-destructive/70" : "text-muted-foreground",
                )}
              >
                {m.status === "failed" ? "Failed " : ""}
                {formatDay(m.resolvedAt)}
              </span>
            )}
            {/* Row actions float over the end of the row on hover/focus, so they never squeeze the title. */}
            <div className="bg-popover pointer-events-none absolute inset-y-1 right-1 flex items-center rounded-md pl-1 opacity-0 shadow-[-12px_0_12px_-4px_var(--popover)] transition-opacity group-hover/ms:pointer-events-auto group-hover/ms:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
              <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={index === 0} onClick={() => move(m.id, "up")}>
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Move down"
                disabled={index === siblingCount - 1}
                onClick={() => move(m.id, "down")}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Nest under the milestone above"
                title="Nest under the milestone above (it becomes a prerequisite)"
                disabled={index === 0}
                onClick={() => move(m.id, "indent")}
              >
                <IndentIncreaseIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Move out a level"
                title="Move out a level"
                disabled={depth === 0}
                onClick={() => move(m.id, "outdent")}
              >
                <IndentDecreaseIcon />
              </Button>
              {canFail && m.status === "open" && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Mark failed"
                  title="Mark failed (anything still open under it fails too)"
                  onClick={() => setStatus(m, "failed")}
                  className="hover:text-destructive"
                >
                  <CircleXIcon />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Delete milestone"
                title="Delete (anything nested under it moves up a level)"
                onClick={() => void run(() => api.deleteMilestone(m.id), "Could not delete.")}
              >
                <XIcon />
              </Button>
            </div>
          </div>
        );
      })}

      <form onSubmit={add} className={cn("flex h-9 items-center gap-2.5", ROW_INSET)}>
        <PlusIcon className="text-muted-foreground size-4 shrink-0" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a milestone"
          className="h-7 border-transparent bg-transparent px-1 text-sm shadow-none focus-visible:border-input dark:bg-transparent"
        />
      </form>
    </div>
  );
}
