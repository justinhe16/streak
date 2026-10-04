"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDay } from "@/lib/dates";
import { scoreColor } from "@/lib/score-color";
import type { DayCell, GridRow } from "@/lib/streak";
import { cn } from "@/lib/utils";

export const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Month gutter · seven day squares · week pill. Fixed widths so the pinned header lines up. */
export const GRID_COLS = "grid grid-cols-[3.25rem_auto_3.5rem] items-center gap-x-2.5";
export const DAY_COLS = "grid grid-cols-[repeat(7,2rem)] gap-1 sm:grid-cols-[repeat(7,2.25rem)] sm:gap-1.5";

export function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

type WeekRowProps = {
  row: GridRow;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
};

export function WeekRow({ row, selectedDate, onSelectDay }: WeekRowProps) {
  const color = scoreColor(row.score);
  const scoreStyle = color ? ({ "--score": color } as React.CSSProperties) : undefined;

  return (
    <div className={GRID_COLS} data-week={row.weekStart}>
      <div className="text-muted-foreground truncate text-right text-[10px] font-medium tracking-wide uppercase">
        {row.monthLabel}
      </div>

      <div
        style={scoreStyle}
        className={cn(
          "rounded-[14px] border p-1 transition-colors duration-300",
          color ? "score-tint" : row.future ? "bg-muted/15 border-border/30" : "bg-muted/30 border-border/50",
          row.provisional && "border-dashed",
        )}
      >
        <div className={DAY_COLS}>
          {row.days.map((cell) => (
            <DaySquare
              key={cell.date}
              cell={cell}
              selected={cell.date === selectedDate}
              onSelect={() => onSelectDay(cell.date)}
            />
          ))}
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            style={scoreStyle}
            className={cn(
              "tabular w-fit cursor-default rounded-full px-2 py-0.5 text-[11px] font-semibold",
              color ? "score-pill" : "text-muted-foreground/50 font-normal",
            )}
          >
            {row.future ? "" : row.score === null ? "—" : percent(row.score)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-64">
          <WeekBreakdown row={row} />
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function WeekBreakdown({ row }: { row: GridRow }) {
  return (
    <div className="flex flex-col gap-1 py-0.5">
      <p className="font-medium">
        Week of {formatDay(row.weekStart, { year: true })}
        {row.provisional && <span className="opacity-70"> · in progress</span>}
      </p>
      {row.goals.length === 0 ? (
        <p className="opacity-70">No goals active this week.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {row.goals.map((g) => (
            <li key={g.goalId} className="flex items-center justify-between gap-3">
              <span className="truncate">{g.title}</span>
              <span className="tabular shrink-0 opacity-80">
                {g.done}/{g.target}
                {row.provisional && !g.decided ? " · open" : g.met ? " ✓" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DaySquare({ cell, selected, onSelect }: { cell: DayCell; selected: boolean; onSelect: () => void }) {
  if (cell.future) {
    return (
      <div aria-hidden className="grid aspect-square place-items-center rounded-[10px]">
        <span className="bg-foreground/15 size-1 rounded-full" />
      </div>
    );
  }

  const ratio = cell.possible === 0 ? 0 : cell.done / cell.possible;
  const label = `${formatDay(cell.date, { weekday: true, year: true })} · ${cell.done} of ${cell.possible} done`;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      // Fill deepens with the share of goals done that day, in the week's hue.
      style={{ "--fill": `${cell.possible === 0 ? 0 : 10 + ratio * 62}%` } as React.CSSProperties}
      className={cn(
        "day-fill relative grid aspect-square place-items-center rounded-[10px] outline-none",
        "transition-[transform,box-shadow] duration-150 hover:z-10 hover:scale-110 hover:shadow-sm",
        "focus-visible:ring-ring/60 focus-visible:ring-2",
        cell.isToday && "ring-foreground/80 ring-offset-card ring-2 ring-offset-1",
        selected && "ring-primary ring-offset-card ring-2 ring-offset-1",
      )}
    >
      <span
        className={cn(
          "text-[13px] leading-none tabular-nums",
          cell.done === 0
            ? "text-muted-foreground/60"
            : ratio >= 0.6
              ? "text-foreground font-semibold"
              : "text-foreground/80 font-medium",
        )}
      >
        {cell.done}
      </span>
      {cell.hasReflection && (
        <span className="bg-primary ring-card absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-2" />
      )}
    </button>
  );
}
