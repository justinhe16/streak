import { formatDay } from "@/lib/dates";
import type { Goal } from "@/lib/types";

export function frequencyLabel(daysPerWeek: number): string {
  return daysPerWeek === 7 ? "Daily" : `${daysPerWeek}×/week`;
}

export function rangeLabel(goal: Pick<Goal, "startDate" | "endDate">): string {
  const start = formatDay(goal.startDate, { year: true });
  return goal.endDate ? `${start} → ${formatDay(goal.endDate, { year: true })}` : `${start} → ongoing`;
}
