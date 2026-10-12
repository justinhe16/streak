/**
 * Date rules for goals and OKRs. Pure, so the API enforces exactly what the UI
 * checks.
 *
 * Goal dates can grow but never rewrite the past:
 * - start can move earlier; it can move freely only while the goal hasn't begun;
 * - end can move later, become perpetual, or move earlier but never before today;
 * - end stays on or after start.
 * Check-ins are always <= today, so no existing check-in ever falls outside the
 * range. Frequency is fixed and isn't handled here.
 */

type GoalRange = { startDate: string; endDate: string | null };
type OkrRange = { startDate: string | null; endDate: string | null };

/** Null when the change is allowed, otherwise a message for the user. */
export function validateGoalDates(current: GoalRange, next: GoalRange, today: string): string | null {
  const started = current.startDate <= today;
  if (started && next.startDate > current.startDate) {
    return "Start can only move earlier once the goal has begun.";
  }
  if (next.endDate !== null && next.endDate !== current.endDate && next.endDate < today) {
    return "End can't be before today.";
  }
  if (next.endDate !== null && next.endDate < next.startDate) return "End must be on or after the start.";
  return null;
}

export type GoalDateUpdate = { id: string; startDate: string; endDate: string | null };

/**
 * When an OKR's dates change, linked goals that were aligned with the old dates
 * follow: a goal ending on the old end gets the new end, and a goal starting on
 * the old start gets the new start only if it hasn't begun. Anything the goal
 * rules would reject (e.g. an end before today) is clamped or skipped.
 */
export function followOkrDates(
  goals: readonly (GoalRange & { id: string })[],
  before: OkrRange,
  after: OkrRange,
  today: string,
): GoalDateUpdate[] {
  const updates: GoalDateUpdate[] = [];
  for (const g of goals) {
    let startDate = g.startDate;
    let endDate = g.endDate;

    if (before.startDate !== null && after.startDate !== null && g.startDate === before.startDate && g.startDate > today) {
      startDate = after.startDate;
    }
    if (before.endDate !== after.endDate && g.endDate === before.endDate && before.endDate !== null) {
      // Never cut into the past: an earlier end is clamped to today.
      endDate = after.endDate === null ? null : after.endDate < today ? today : after.endDate;
    }

    if (startDate === g.startDate && endDate === g.endDate) continue;
    if (validateGoalDates(g, { startDate, endDate }, today) !== null) continue;
    updates.push({ id: g.id, startDate, endDate });
  }
  return updates;
}

/** Time-bound OKRs (a date range or a label) can fail milestones. */
export function isTimeBound(okr: { timeframe: string | null; endDate: string | null }): boolean {
  return Boolean(okr.timeframe) || okr.endDate !== null;
}

// --- Parsing free-text timeframes (used once, by the backfill script) --------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function lastDay(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function month(name: string): number | null {
  const i = MONTHS.indexOf(name.slice(0, 3).toLowerCase());
  return i === -1 ? null : i + 1;
}

/** "Oct 1, 2026" / "Oct 1" (with a fallback year) / "2026-10-01". */
function parseDay(text: string, fallbackYear?: number): { date: string; year: number } | null {
  const t = text.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return { date: t, year: Number(m[1]) };
  m = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/.exec(t);
  if (!m) return null;
  const mon = month(m[1]);
  const year = m[3] ? Number(m[3]) : fallbackYear;
  const day = Number(m[2]);
  if (!mon || !year || day < 1 || day > lastDay(year, mon)) return null;
  return { date: iso(year, mon, day), year };
}

/**
 * Best-effort dates from a free-text timeframe. Handles "2026", "Q4 2026",
 * "H2 2026", "Oct 2026", and ranges like "Oct 1, 2026 - Oct 12, 2026",
 * "Oct 1 - Oct 12, 2026" or "2026-10-01 – 2026-10-12". Null if unrecognized.
 */
export function parseTimeframe(text: string): OkrRange | null {
  const t = text.trim();
  let m = /^(\d{4})$/.exec(t);
  if (m) return { startDate: iso(+m[1], 1, 1), endDate: iso(+m[1], 12, 31) };

  m = /^Q([1-4])\s+(\d{4})$/i.exec(t);
  if (m) {
    const q = +m[1];
    const y = +m[2];
    return { startDate: iso(y, q * 3 - 2, 1), endDate: iso(y, q * 3, lastDay(y, q * 3)) };
  }

  m = /^H([12])\s+(\d{4})$/i.exec(t);
  if (m) {
    const y = +m[2];
    return m[1] === "1"
      ? { startDate: iso(y, 1, 1), endDate: iso(y, 6, 30) }
      : { startDate: iso(y, 7, 1), endDate: iso(y, 12, 31) };
  }

  m = /^([A-Za-z]+)\.?\s+(\d{4})$/.exec(t);
  if (m && month(m[1])) {
    const mon = month(m[1])!;
    const y = +m[2];
    return { startDate: iso(y, mon, 1), endDate: iso(y, mon, lastDay(y, mon)) };
  }

  const parts = t.split(/\s+(?:-|–|—|to)\s+/i);
  if (parts.length === 2) {
    const end = parseDay(parts[1]);
    const start = end ? parseDay(parts[0], end.year) : null;
    if (start && end && end.date >= start.date) return { startDate: start.date, endDate: end.date };
  }
  return null;
}
