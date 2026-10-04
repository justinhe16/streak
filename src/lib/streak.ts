/**
 * Scoring for the week grid. Pure functions over plain data so they can be unit
 * tested without a database.
 *
 * Rules (weeks run Monday–Sunday):
 * - A goal asks for `daysPerWeek` check-ins a week. In a week the goal only
 *   partly covers, the target is prorated: ceil(daysPerWeek × activeDays / 7).
 * - Each goal earns partial credit, min(done / target, 1); the week's score is
 *   the mean credit of its goals.
 * - While a week is still running, only goals whose outcome is already decided
 *   count: met ones score 1, ones that can no longer be met score their best
 *   achievable credit, and the rest wait.
 */

import { addDays, monthLabel, weekDays, weekStart } from "./dates";

export type GoalSpec = {
  id: string;
  title: string;
  daysPerWeek: number;
  startDate: string;
  endDate: string | null;
};

/** Done check-ins, keyed by `checkInKey(goalId, date)`. */
export type CheckInSet = ReadonlySet<string>;

export function checkInKey(goalId: string, date: string): string {
  return `${goalId}|${date}`;
}

export function isActive(goal: Pick<GoalSpec, "startDate" | "endDate">, date: string): boolean {
  return date >= goal.startDate && (goal.endDate === null || date <= goal.endDate);
}

export function weekTarget(goal: GoalSpec, monday: string): { activeDays: number; target: number } {
  const activeDays = weekDays(monday).filter((d) => isActive(goal, d)).length;
  const target = activeDays === 0 ? 0 : Math.ceil((goal.daysPerWeek * activeDays) / 7);
  return { activeDays, target };
}

export type GoalWeek = {
  goalId: string;
  weekStart: string;
  title: string;
  done: number;
  target: number;
  /** min(done / target, 1) as things stand. */
  credit: number;
  /** True once the outcome can no longer change direction (met, or out of reach). */
  decided: boolean;
  met: boolean;
};

export function goalWeekCredit(goal: GoalSpec, checkIns: CheckInSet, monday: string, today: string): GoalWeek {
  const { target } = weekTarget(goal, monday);
  let done = 0;
  let remaining = 0; // active days from today on that could still be checked off
  for (const d of weekDays(monday)) {
    if (!isActive(goal, d)) continue;
    if (checkIns.has(checkInKey(goal.id, d))) done++;
    else if (d >= today) remaining++;
  }
  const met = target > 0 && done >= target;
  const decided = met || done + remaining < target;
  // Out of reach: score the best it could still end at, so the row only moves
  // when that outcome is locked in. Past weeks have remaining = 0, i.e. done/target.
  const credit = target === 0 ? 0 : met ? 1 : decided ? (done + remaining) / target : done / target;
  return { goalId: goal.id, weekStart: monday, title: goal.title, done, target, credit, decided, met };
}

export type WeekScore = {
  /** 0..1, or null when nothing counts yet (no active goals, none decided, or a future week). */
  score: number | null;
  /** The week is still running. */
  provisional: boolean;
  /** The week hasn't started yet. */
  future: boolean;
  goals: GoalWeek[];
};

export function weekScore(goals: GoalSpec[], checkIns: CheckInSet, monday: string, today: string): WeekScore {
  const future = monday > today;
  const provisional = !future && addDays(monday, 6) >= today;
  const rows = goals
    .filter((g) => weekTarget(g, monday).target > 0)
    .map((g) => goalWeekCredit(g, checkIns, monday, today));
  if (future) return { score: null, provisional, future, goals: rows };
  const counted = provisional ? rows.filter((r) => r.decided) : rows;
  const score = counted.length === 0 ? null : counted.reduce((s, r) => s + r.credit, 0) / counted.length;
  return { score, provisional, future, goals: rows };
}

/** One goal's weeks from its first through the current (or its last) week, oldest first. */
export function goalWeeks(goal: GoalSpec, checkIns: CheckInSet, today: string): GoalWeek[] {
  const last = weekStart(goal.endDate !== null && goal.endDate < today ? goal.endDate : today);
  const out: GoalWeek[] = [];
  for (let monday = weekStart(goal.startDate); monday <= last; monday = addDays(monday, 7)) {
    out.push(goalWeekCredit(goal, checkIns, monday, today));
  }
  return out;
}

/** Mean credit over the goals' finished weeks (the running week is excluded). Null with no history. */
export function averageCredit(goals: GoalSpec[], checkIns: CheckInSet, today: string): number | null {
  const current = weekStart(today);
  let sum = 0;
  let n = 0;
  for (const g of goals) {
    for (const w of goalWeeks(g, checkIns, today)) {
      if (w.weekStart >= current) continue;
      sum += w.credit;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

export type DayCell = {
  date: string;
  isToday: boolean;
  /** Future days carry no counts and can't be checked off. */
  future: boolean;
  done: number;
  possible: number;
  hasReflection: boolean;
};

export function dayCell(
  goals: GoalSpec[],
  checkIns: CheckInSet,
  date: string,
  today: string,
  reflectionDays: ReadonlySet<string> = new Set(),
): DayCell {
  const future = date > today;
  let done = 0;
  let possible = 0;
  if (!future) {
    for (const g of goals) {
      if (!isActive(g, date)) continue;
      possible++;
      if (checkIns.has(checkInKey(g.id, date))) done++;
    }
  }
  return { date, isToday: date === today, future, done, possible, hasReflection: reflectionDays.has(date) };
}

export type GridRow = WeekScore & {
  weekStart: string;
  /** Set on the first row and on rows where a new month begins. */
  monthLabel: string | null;
  days: DayCell[];
};

export type GridPadding = {
  /** Extra (empty) weeks before the earliest data, or before the current week when there's none. */
  before?: number;
  /** Upcoming (empty) weeks to show after the current one. */
  after?: number;
};

/** Every week from the earliest goal (or reflection) through the current week, oldest first, plus optional padding. */
export function buildGrid(
  goals: GoalSpec[],
  checkIns: CheckInSet,
  reflectionDays: ReadonlySet<string>,
  today: string,
  { before = 0, after = 0 }: GridPadding = {},
): GridRow[] {
  const current = weekStart(today);
  const starts = [...goals.map((g) => g.startDate), ...reflectionDays].filter((d) => d <= today);
  const earliest = starts.length ? weekStart(starts.reduce((a, b) => (a < b ? a : b))) : current;
  const first = addDays(earliest, -7 * before);
  const last = addDays(current, 7 * after);

  const rows: GridRow[] = [];
  for (let monday = first; monday <= last; monday = addDays(monday, 7)) {
    const days = weekDays(monday).map((d) => dayCell(goals, checkIns, d, today, reflectionDays));
    const newMonth = days.find((d) => d.date.endsWith("-01"));
    const label = rows.length === 0 ? monthLabel(monday) : newMonth ? monthLabel(newMonth.date) : null;
    rows.push({ weekStart: monday, monthLabel: label, days, ...weekScore(goals, checkIns, monday, today) });
  }
  return rows;
}
