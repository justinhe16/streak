import { describe, expect, it } from "vitest";
import { addDays, weekStart, weekdayIndex } from "@/lib/dates";
import { scoreColor, scoreLch } from "@/lib/score-color";
import {
  averageCredit,
  buildGrid,
  checkInKey,
  dayCell,
  goalWeekCredit,
  goalWeeks,
  weekScore,
  weekTarget,
  type GoalSpec,
} from "@/lib/streak";

// 2026-09-28 is a Monday.
const MON = "2026-09-28";
const SUN = "2026-10-04";
const AFTER = "2026-10-10"; // a "today" after the week is over

function goal(over: Partial<GoalSpec> = {}): GoalSpec {
  return { id: "g", title: "G", daysPerWeek: 7, startDate: "2026-01-01", endDate: null, ...over };
}

function checks(goalId: string, ...dates: string[]): Set<string> {
  return new Set(dates.map((d) => checkInKey(goalId, d)));
}

const day = (i: number) => addDays(MON, i);

describe("dates", () => {
  it("weeks start on Monday", () => {
    expect(weekdayIndex(MON)).toBe(0);
    expect(weekdayIndex(SUN)).toBe(6);
    expect(weekStart(SUN)).toBe(MON);
    expect(weekStart(MON)).toBe(MON);
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
  });

  it("crosses month and DST boundaries cleanly", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("weekTarget", () => {
  it("is the full frequency for a fully covered week", () => {
    expect(weekTarget(goal({ daysPerWeek: 4 }), MON)).toEqual({ activeDays: 7, target: 4 });
  });

  it("prorates when the goal starts mid-week", () => {
    // Starts Friday: Fri, Sat, Sun active → ceil(4 × 3 / 7) = 2
    expect(weekTarget(goal({ daysPerWeek: 4, startDate: day(4) }), MON)).toEqual({ activeDays: 3, target: 2 });
  });

  it("prorates when the goal ends mid-week", () => {
    // Ends Tuesday: Mon, Tue → ceil(3 × 2 / 7) = 1
    expect(weekTarget(goal({ daysPerWeek: 3, endDate: day(1) }), MON)).toEqual({ activeDays: 2, target: 1 });
  });

  it("asks an every-day goal for one per active day", () => {
    expect(weekTarget(goal({ startDate: day(2) }), MON).target).toBe(5);
  });

  it("is zero outside the range", () => {
    expect(weekTarget(goal({ startDate: "2027-01-01" }), MON).target).toBe(0);
    expect(weekTarget(goal({ endDate: "2026-01-31" }), MON).target).toBe(0);
  });
});

describe("goalWeekCredit", () => {
  it("gives partial credit in a finished week", () => {
    const g = goal({ daysPerWeek: 4 });
    const r = goalWeekCredit(g, checks("g", day(0), day(2), day(4)), MON, AFTER);
    expect(r).toMatchObject({ done: 3, target: 4, decided: true, met: false });
    expect(r.credit).toBeCloseTo(0.75);
  });

  it("caps credit at 1", () => {
    const g = goal({ daysPerWeek: 2 });
    const r = goalWeekCredit(g, checks("g", day(0), day(1), day(2)), MON, AFTER);
    expect(r.credit).toBe(1);
  });

  it("is undecided mid-week while still reachable", () => {
    const g = goal({ daysPerWeek: 3 });
    const r = goalWeekCredit(g, checks("g", day(0)), MON, day(3));
    expect(r.decided).toBe(false);
  });

  it("is decided mid-week once met", () => {
    const g = goal({ daysPerWeek: 2 });
    const r = goalWeekCredit(g, checks("g", day(0), day(1)), MON, day(2));
    expect(r).toMatchObject({ decided: true, met: true, credit: 1 });
  });

  it("scores the best achievable credit once out of reach", () => {
    // Daily goal, nothing done Mon–Thu, today is Fri: Fri/Sat/Sun still open → best 3/7.
    const r = goalWeekCredit(goal(), new Set(), MON, day(4));
    expect(r.decided).toBe(true);
    expect(r.credit).toBeCloseTo(3 / 7);
  });
});

describe("weekScore", () => {
  it("averages credit across active goals (2 of 3 met → between)", () => {
    const goals = [goal({ id: "a" }), goal({ id: "b", daysPerWeek: 1 }), goal({ id: "c", daysPerWeek: 3 })];
    const all = Array.from({ length: 7 }, (_, i) => day(i));
    const set = new Set([...checks("a", ...all), ...checks("b", day(3))]);
    const r = weekScore(goals, set, MON, AFTER);
    expect(r.provisional).toBe(false);
    expect(r.score).toBeCloseTo(2 / 3);
  });

  it("is null when no goal is active", () => {
    expect(weekScore([goal({ startDate: "2027-01-01" })], new Set(), MON, AFTER).score).toBeNull();
    expect(weekScore([], new Set(), MON, AFTER).score).toBeNull();
  });

  it("counts only decided goals in the current week", () => {
    const goals = [goal({ id: "a", daysPerWeek: 1 }), goal({ id: "b", daysPerWeek: 3 })];
    const r = weekScore(goals, checks("a", day(0)), MON, day(1));
    expect(r.provisional).toBe(true);
    expect(r.score).toBe(1); // "a" met; "b" still in play and left out
  });

  it("is null in the current week when nothing is decided yet", () => {
    const r = weekScore([goal({ daysPerWeek: 3 })], new Set(), MON, day(0));
    expect(r.score).toBeNull();
    expect(r.provisional).toBe(true);
  });
});

describe("dayCell", () => {
  it("counts done out of possible", () => {
    const goals = [goal({ id: "a" }), goal({ id: "b" }), goal({ id: "c", startDate: day(3) })];
    expect(dayCell(goals, checks("a", day(1)), day(1), AFTER)).toMatchObject({ done: 1, possible: 2, future: false });
  });

  it("leaves future days empty", () => {
    expect(dayCell([goal()], new Set(), day(5), day(2))).toMatchObject({ future: true, done: 0, possible: 0 });
  });
});

describe("buildGrid", () => {
  it("runs from the earliest goal's week through the current week", () => {
    const rows = buildGrid([goal({ startDate: "2026-09-16" })], new Set(), new Set(), "2026-09-30");
    expect(rows.map((r) => r.weekStart)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(rows[0].monthLabel).toBe("Sep 2026");
    expect(rows[2].monthLabel).toBe("Oct 2026");
    expect(rows[1].monthLabel).toBeNull();
  });

  it("pads empty weeks before and after", () => {
    const rows = buildGrid([], new Set(), new Set(), "2026-09-30", { before: 2, after: 1 });
    expect(rows.map((r) => r.weekStart)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(rows.at(-1)).toMatchObject({ future: true, provisional: false, score: null });
    expect(rows[2]).toMatchObject({ future: false, provisional: true });
  });

  it("pads before the earliest data, not just before today", () => {
    const rows = buildGrid([goal({ startDate: "2026-09-16" })], new Set(), new Set(), "2026-09-30", { before: 1 });
    expect(rows[0].weekStart).toBe("2026-09-07");
  });

  it("never scores a future week, even with active goals", () => {
    const r = weekScore([goal()], new Set(), "2026-10-05", "2026-09-30");
    expect(r).toMatchObject({ score: null, future: true, provisional: false });
  });

  it("marks reflection days", () => {
    const rows = buildGrid([], new Set(), new Set(["2026-09-29"]), "2026-09-30");
    expect(rows).toHaveLength(1);
    expect(rows[0].days[1].hasReflection).toBe(true);
  });
});

describe("goal history", () => {
  it("lists weeks from start through the current week", () => {
    const weeks = goalWeeks(goal({ startDate: "2026-09-16" }), new Set(), "2026-09-30");
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28"]);
  });

  it("stops at an ended goal's last week", () => {
    const weeks = goalWeeks(goal({ startDate: "2026-09-01", endDate: "2026-09-10" }), new Set(), "2026-09-30");
    expect(weeks.at(-1)?.weekStart).toBe("2026-09-07");
  });

  it("averages finished weeks only", () => {
    // Week of Sep 21 fully done, current week ignored.
    const g = goal({ startDate: "2026-09-21" });
    const done = checks("g", ...Array.from({ length: 7 }, (_, i) => addDays("2026-09-21", i)));
    expect(averageCredit([g], done, "2026-09-30")).toBe(1);
    expect(averageCredit([goal({ startDate: "2026-09-29" })], new Set(), "2026-09-30")).toBeNull();
  });
});

describe("scoreColor", () => {
  it("ramps red → yellow → green", () => {
    expect(scoreLch(0).h).toBe(25);
    expect(scoreLch(0.5).h).toBe(85);
    expect(scoreLch(1).h).toBe(148);
    expect(scoreLch(2).h).toBe(148);
    expect(scoreColor(null)).toBeNull();
  });
});
