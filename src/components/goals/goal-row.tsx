"use client";

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDay, weekStart } from "@/lib/dates";
import { scoreColor } from "@/lib/score-color";
import { goalWeeks, type CheckInSet } from "@/lib/streak";
import type { Goal } from "@/lib/types";
import { frequencyLabel, rangeLabel } from "./goal-utils";
import { ROW_INSET } from "./layout";
import { cn } from "@/lib/utils";

const RECENT_WEEKS = 10;

type GoalRowProps = {
  goal: Goal;
  checkIns: CheckInSet;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
  /** How many recent weeks to show as dots. */
  weeks?: number;
};

export function GoalRow({ goal, checkIns, today, onEdit, onDelete, weeks: recent = RECENT_WEEKS }: GoalRowProps) {
  const upcoming = goal.startDate > today;
  const ended = goal.endDate !== null && goal.endDate < today;
  const weeks = upcoming ? [] : goalWeeks(goal, checkIns, today).slice(-recent);
  const currentWeek = weekStart(today);

  return (
    <div className={cn("group/goal hover:bg-muted/40 flex items-center gap-2.5 rounded-lg py-2 transition-colors", ROW_INSET)}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onEdit} className="truncate text-left text-[13px] font-medium outline-none hover:underline">
            {goal.title}
          </button>
          <span className="bg-muted text-muted-foreground shrink-0 rounded-md px-1.5 py-px text-[11px] font-medium">
            {frequencyLabel(goal.daysPerWeek)}
          </span>
          {upcoming && <span className="text-muted-foreground shrink-0 text-[11px]">upcoming</span>}
          {ended && <span className="text-muted-foreground shrink-0 text-[11px]">ended</span>}
        </div>
        <span className="text-muted-foreground truncate text-[11px]">
          {rangeLabel(goal)}
          {goal.description && ` · ${goal.description}`}
        </span>
      </div>

      {/* Recent weeks, oldest → newest. Hollow = the running week. */}
      <div className="flex items-center gap-[3px]" aria-label="Recent weeks">
        {weeks.map((w) => {
          const running = w.weekStart === currentWeek;
          const color = scoreColor(w.credit);
          return (
            <Tooltip key={w.weekStart}>
              <TooltipTrigger asChild>
                <span
                  className="size-2 rounded-full"
                  style={running ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { background: color ?? undefined }}
                />
              </TooltipTrigger>
              <TooltipContent>
                Week of {formatDay(w.weekStart)} · {w.done}/{w.target}
                {running ? " so far" : ""}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${goal.title}`}
            className="text-muted-foreground opacity-60 group-hover/goal:opacity-100"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <PencilIcon /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
