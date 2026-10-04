"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Panel } from "@/components/workspace/panel";
import { weekStart } from "@/lib/dates";
import { buildGrid, type CheckInSet, type GoalSpec } from "@/lib/streak";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DayDialog } from "./day-dialog";
import { DAY_COLS, GRID_COLS, WEEKDAYS, WeekRow } from "./week-grid";

/** Empty weeks shown on both sides of your data, so there's always room to scroll and today sits mid-grid. */
const PADDING = { before: 10, after: 10 };

/** Where the current week lands on open, as a fraction of the visible height from the top. */
const TODAY_POSITION = 0.4;

type GridPanelProps = {
  snapshot: Snapshot;
  checkIns: CheckInSet;
  goalSpecs: GoalSpec[];
  reflectionDays: ReadonlySet<string>;
  setCheckIn: (goalId: string, date: string, done: boolean) => void;
  onOpenReflection: (id: string) => void;
  onAddGoal: () => void;
  onClose: () => void;
};

export function GridPanel({
  snapshot,
  checkIns,
  goalSpecs,
  reflectionDays,
  setCheckIn,
  onOpenReflection,
  onAddGoal,
  onClose,
}: GridPanelProps) {
  const { today } = snapshot;
  const [selected, setSelected] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () => buildGrid(goalSpecs, checkIns, reflectionDays, today, PADDING),
    [goalSpecs, checkIns, reflectionDays, today],
  );

  // Edges only fade/blur while there's more grid to scroll to in that direction.
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  // Open with the current week a little above the middle.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const row = el?.querySelector<HTMLElement>(`[data-week="${weekStart(today)}"]`);
    if (el && row) el.scrollTop = row.offsetTop - el.clientHeight * TODAY_POSITION + row.offsetHeight / 2;
    measure();
  }, [today, measure]);

  return (
    <Panel
      id="grid"
      width="w-[29rem]"
      onClose={onClose}
      scroll={false}
    >
      {/* Pinned weekday header */}
      <div className={cn(GRID_COLS, "mx-auto shrink-0 pt-8")}>
        <span />
        <div className={cn(DAY_COLS, "px-[5px]")}>
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="text-muted-foreground/80 text-center text-[10px] font-medium">
              {d}
            </span>
          ))}
        </div>
        <span />
      </div>

      <div className="grid-frame relative mb-8 min-h-0 flex-1" data-top={edges.top} data-bottom={edges.bottom}>
        <div aria-hidden className="edge-blur edge-blur-top">
          <div />
          <div />
          <div />
        </div>
        <div
          ref={scrollRef}
          onScroll={measure}
          className="grid-scroll relative h-full overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto flex w-fit flex-col gap-1.5 pb-4">
            {rows.map((row) => (
              <WeekRow key={row.weekStart} row={row} selectedDate={selected} onSelectDay={setSelected} />
            ))}
          </div>
        </div>
        <div aria-hidden className="edge-blur edge-blur-bottom">
          <div />
          <div />
          <div />
        </div>
      </div>

      <DayDialog
        date={selected}
        today={today}
        goals={snapshot.goals}
        okrs={snapshot.okrs}
        checkIns={checkIns}
        reflections={snapshot.reflections}
        onOpenChange={(open) => !open && setSelected(null)}
        onToggle={setCheckIn}
        onOpenReflection={(id) => {
          setSelected(null);
          onOpenReflection(id);
        }}
        onAddGoal={() => {
          setSelected(null);
          onAddGoal();
        }}
      />
    </Panel>
  );
}
