"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { formatDay } from "@/lib/dates";
import type { Milestone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ROW_INSET } from "./layout";

type MilestoneListProps = {
  okrId: string;
  milestones: Milestone[];
  onChanged: () => Promise<void>;
};

export function MilestoneList({ okrId, milestones, onChanged }: MilestoneListProps) {
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

  function move(index: number, delta: number) {
    const ids = milestones.map((m) => m.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    void run(() => api.reorderMilestones(okrId, ids), "Could not reorder.");
  }

  async function commitEdit(m: Milestone) {
    const text = editText.trim();
    setEditingId(null);
    if (!text || text === m.text) return;
    await run(() => api.updateMilestone(m.id, { text }), "Could not rename the milestone.");
  }

  return (
    <div className="flex flex-col gap-0.5">
      {milestones.map((m, i) => (
        <div key={m.id} className={cn("group/ms hover:bg-muted/40 flex h-9 items-center gap-2.5 rounded-md", ROW_INSET)}>
          <Checkbox
            checked={m.done}
            onCheckedChange={(v) => void run(() => api.updateMilestone(m.id, { done: v === true }), "Could not update.")}
            aria-label={m.text}
          />
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
                m.done && "text-muted-foreground line-through decoration-1",
              )}
              title="Click to edit"
            >
              {m.text}
            </button>
          )}
          {m.done && m.doneAt && (
            <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">{formatDay(m.doneAt)}</span>
          )}
          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/ms:opacity-100 focus-within:opacity-100">
            <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Move down"
              disabled={i === milestones.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDownIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete milestone"
              onClick={() => void run(() => api.deleteMilestone(m.id), "Could not delete.")}
            >
              <XIcon />
            </Button>
          </div>
        </div>
      ))}

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
