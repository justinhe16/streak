import { formatDay } from "@/lib/dates";
import type { Goal, Okr } from "@/lib/types";

export function frequencyLabel(daysPerWeek: number): string {
  return daysPerWeek === 7 ? "Daily" : `${daysPerWeek}×/week`;
}

export function rangeLabel(goal: Pick<Goal, "startDate" | "endDate">): string {
  const start = formatDay(goal.startDate, { year: true });
  return goal.endDate ? `${start} → ${formatDay(goal.endDate, { year: true })}` : `${start} → ongoing`;
}

/** What to show for an OKR's time span: its custom label, else its date range, else nothing. */
export function okrLabel(okr: Pick<Okr, "timeframe" | "startDate" | "endDate">): string | null {
  if (okr.timeframe) return okr.timeframe;
  if (!okr.startDate && !okr.endDate) return null;
  if (!okr.endDate) return `From ${formatDay(okr.startDate!, { year: true })}`;
  if (!okr.startDate) return `Until ${formatDay(okr.endDate, { year: true })}`;
  const sameYear = okr.startDate.slice(0, 4) === okr.endDate.slice(0, 4);
  return `${formatDay(okr.startDate, { year: !sameYear })} – ${formatDay(okr.endDate, { year: true })}`;
}
