import { describe, expect, it } from "vitest";
import { followOkrDates, isTimeBound, parseTimeframe, validateGoalDates } from "@/lib/goal-dates";

const TODAY = "2026-10-11";
const started = { startDate: "2026-10-01", endDate: "2026-10-09" };
const upcoming = { startDate: "2026-11-01", endDate: "2026-11-30" };

describe("validateGoalDates", () => {
  it("lets a started goal's start move earlier but not later", () => {
    expect(validateGoalDates(started, { ...started, startDate: "2026-09-25" }, TODAY)).toBeNull();
    expect(validateGoalDates(started, { ...started, startDate: "2026-10-03" }, TODAY)).toMatch(/earlier/);
  });

  it("lets an upcoming goal's start move freely", () => {
    expect(validateGoalDates(upcoming, { ...upcoming, startDate: "2026-11-15" }, TODAY)).toBeNull();
  });

  it("allows extending or making perpetual, even for a goal that already ended", () => {
    expect(validateGoalDates(started, { ...started, endDate: "2026-10-12" }, TODAY)).toBeNull();
    expect(validateGoalDates(started, { ...started, endDate: null }, TODAY)).toBeNull();
  });

  it("never lets the end move before today", () => {
    const running = { startDate: "2026-10-01", endDate: "2026-12-31" };
    expect(validateGoalDates(running, { ...running, endDate: "2026-10-20" }, TODAY)).toBeNull();
    expect(validateGoalDates(running, { ...running, endDate: TODAY }, TODAY)).toBeNull();
    expect(validateGoalDates(running, { ...running, endDate: "2026-10-05" }, TODAY)).toMatch(/before today/);
  });

  it("keeps an untouched past end valid (editing other fields)", () => {
    expect(validateGoalDates(started, started, TODAY)).toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(validateGoalDates(upcoming, { startDate: "2026-11-20", endDate: "2026-11-15" }, TODAY)).toMatch(/after the start/);
  });
});

describe("followOkrDates", () => {
  const before = { startDate: "2026-10-01", endDate: "2026-10-09" };

  it("moves aligned goals to the new end and leaves shorter ones alone", () => {
    const goals = [
      { id: "aligned", ...started },
      { id: "sprint", startDate: "2026-10-01", endDate: "2026-10-05" },
      { id: "forever", startDate: "2026-10-01", endDate: null },
    ];
    expect(followOkrDates(goals, before, { ...before, endDate: "2026-10-12" }, TODAY)).toEqual([
      { id: "aligned", startDate: "2026-10-01", endDate: "2026-10-12" },
    ]);
  });

  it("makes aligned goals perpetual when the OKR becomes open-ended", () => {
    const [u] = followOkrDates([{ id: "a", ...started }], before, { ...before, endDate: null }, TODAY);
    expect(u.endDate).toBeNull();
  });

  it("clamps a shortened end to today instead of cutting into the past", () => {
    const b = { startDate: "2026-10-01", endDate: "2026-12-31" };
    const [u] = followOkrDates([{ id: "a", ...b }], b, { ...b, endDate: "2026-10-05" }, TODAY);
    expect(u.endDate).toBe(TODAY);
  });

  it("moves an aligned start only if the goal hasn't begun", () => {
    const b = { startDate: "2026-11-01", endDate: "2026-11-30" };
    const goals = [{ id: "up", ...upcoming }, { id: "old", startDate: "2026-11-01", endDate: "2026-11-30" }];
    const later = followOkrDates(goals, b, { ...b, startDate: "2026-11-08" }, TODAY);
    expect(later.map((u) => u.startDate)).toEqual(["2026-11-08", "2026-11-08"]);
    // Started goal: start is history, leave it.
    expect(followOkrDates([{ id: "s", ...started }], before, { ...before, startDate: "2026-09-01" }, TODAY)).toEqual([]);
  });
});

describe("parseTimeframe", () => {
  it.each([
    ["2026", "2026-01-01", "2026-12-31"],
    ["Q4 2026", "2026-10-01", "2026-12-31"],
    ["q1 2027", "2027-01-01", "2027-03-31"],
    ["H1 2026", "2026-01-01", "2026-06-30"],
    ["H2 2026", "2026-07-01", "2026-12-31"],
    ["Feb 2028", "2028-02-01", "2028-02-29"],
    ["Oct 1, 2026 - Oct 12, 2026", "2026-10-01", "2026-10-12"],
    ["Oct 1 - Oct 12, 2026", "2026-10-01", "2026-10-12"],
    ["Dec 20, 2026 – Jan 5, 2027", "2026-12-20", "2027-01-05"],
    ["2026-10-01 to 2026-10-12", "2026-10-01", "2026-10-12"],
  ])("%s", (text, startDate, endDate) => {
    expect(parseTimeframe(text)).toEqual({ startDate, endDate });
  });

  it.each(["someday", "next year", "Oct 12 - Oct 1, 2026", "Feb 30, 2026 - Mar 1, 2026", ""])(
    "returns null for %j",
    (text) => {
      expect(parseTimeframe(text)).toBeNull();
    },
  );
});

describe("isTimeBound", () => {
  it("counts a label or an end date", () => {
    expect(isTimeBound({ timeframe: "Q4", endDate: null })).toBe(true);
    expect(isTimeBound({ timeframe: null, endDate: "2026-12-31" })).toBe(true);
    expect(isTimeBound({ timeframe: null, endDate: null })).toBe(false);
  });
});
