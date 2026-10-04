"use client";

import { NotebookPenIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDay, weekStart } from "@/lib/dates";
import { checkInKey, goalWeekCredit, isActive, type CheckInSet } from "@/lib/streak";
import type { Goal, Okr, Reflection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { frequencyLabel } from "@/components/goals/goal-utils";

type DayDialogProps = {
  date: string | null;
  today: string;
  goals: Goal[];
  okrs: Okr[];
  checkIns: CheckInSet;
  reflections: Reflection[];
  onOpenChange: (open: boolean) => void;
  onToggle: (goalId: string, date: string, done: boolean) => void;
  onOpenReflection: (id: string) => void;
  onAddGoal: () => void;
};

export function DayDialog({
  date,
  today,
  goals,
  okrs,
  checkIns,
  reflections,
  onOpenChange,
  onToggle,
  onOpenReflection,
  onAddGoal,
}: DayDialogProps) {
  const active = date ? goals.filter((g) => isActive(g, date)) : [];
  const dayReflections = date ? reflections.filter((r) => r.writtenOn === date) : [];
  const okrTitle = new Map(okrs.map((o) => [o.id, o.title]));
  const done = date ? active.filter((g) => checkIns.has(checkInKey(g.id, date))).length : 0;

  return (
    <Dialog open={date !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 sm:max-w-md">
        {date && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
              <DialogTitle className="text-base">
                {formatDay(date, { weekday: true, year: true })}
                {date === today && <span className="text-muted-foreground font-normal"> · today</span>}
              </DialogTitle>
              <DialogDescription className="tabular">
                {active.length === 0 ? "Nothing to check off." : `${done} of ${active.length} done`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 pb-6 sm:px-8 sm:pb-8">
              {active.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-start gap-3 text-sm">
                  <p>No goals were running on this day.</p>
                  <button type="button" onClick={onAddGoal} className="text-primary text-sm underline-offset-4 hover:underline">
                    Set up goals
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {active.map((g) => {
                    const checked = checkIns.has(checkInKey(g.id, date));
                    const week = goalWeekCredit(g, checkIns, weekStart(date), today);
                    const id = `check-${g.id}`;
                    return (
                      <li key={g.id}>
                        <label
                          htmlFor={id}
                          className={cn(
                            "group/field-label flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                            checked ? "bg-muted/60 border-border" : "hover:bg-muted/40 border-border/70",
                          )}
                        >
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(v) => onToggle(g.id, date, v === true)}
                            className="mt-0.5"
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className={cn("text-sm font-medium", checked && "text-muted-foreground line-through decoration-1")}>
                              {g.title}
                            </span>
                            <span className="text-muted-foreground truncate text-xs">
                              {frequencyLabel(g.daysPerWeek)}
                              {g.okrId && okrTitle.has(g.okrId) ? ` · ${okrTitle.get(g.okrId)}` : ""}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "tabular shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                              week.met ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
                            )}
                            title="This week"
                          >
                            {week.done}/{week.target} wk
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {dayReflections.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Reflections</h3>
                  {dayReflections.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onOpenReflection(r.id)}
                      className="hover:bg-muted/50 flex items-center gap-2.5 rounded-lg border p-3 text-left text-sm transition-colors"
                    >
                      <NotebookPenIcon className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate font-medium">{r.title}</span>
                    </button>
                  ))}
                </section>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
