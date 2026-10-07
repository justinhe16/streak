import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { parseExportFile } from "@/lib/backup-format";
import { exportBackupString, importBackup } from "@/lib/backup-io";
import { createDb, type Db } from "@/lib/db/create";
import { builds, checkIns, goals, milestones, okrs, reflections } from "@/lib/db/schema";

const NOW = "2026-09-30T12:00:00.000Z";

function seed(db: Db) {
  db.insert(okrs).values({ id: "o1", title: "Get strong", timeframe: "2026", createdAt: NOW, updatedAt: NOW }).run();
  db.insert(milestones).values({ id: "m1", okrId: "o1", text: "Bench 225", done: true, doneAt: "2026-09-01" }).run();
  db.insert(goals)
    .values({ id: "g1", title: "Lift", daysPerWeek: 3, startDate: "2026-09-01", okrId: "o1", createdAt: NOW, updatedAt: NOW })
    .run();
  db.insert(checkIns).values([
    { goalId: "g1", date: "2026-09-01" },
    { goalId: "g1", date: "2026-09-03" },
  ]).run();
  db.insert(reflections)
    .values({ id: "r1", title: "Q3", body: "# Notes", writtenOn: "2026-09-30", createdAt: NOW, updatedAt: NOW })
    .run();
  db.insert(builds)
    .values({ id: "b1", title: "Streak", category: "web", status: "active", okrId: "o1", createdAt: NOW, updatedAt: NOW })
    .run();
}

describe("export / import", () => {
  let src: Db;
  let dst: Db;

  beforeEach(() => {
    src = createDb(":memory:");
    dst = createDb(":memory:");
    seed(src);
  });

  it("round-trips every table", () => {
    const file = parseExportFile(JSON.parse(exportBackupString(src)));
    const result = importBackup(dst, file, { replace: false });
    expect(result.inserted).toEqual({ okrs: 1, milestones: 1, goals: 1, checkIns: 2, reflections: 1, builds: 1 });
    expect(exportBackupString(dst).replace(/"exportedAt":"[^"]+"/, "")).toBe(
      exportBackupString(src).replace(/"exportedAt":"[^"]+"/, ""),
    );
  });

  it("merge skips rows that already exist", () => {
    const file = parseExportFile(JSON.parse(exportBackupString(src)));
    const result = importBackup(src, file, { replace: false });
    expect(result.skipped.checkIns).toBe(2);
    expect(result.inserted.goals).toBe(0);
  });

  it("replace wipes first", () => {
    dst.insert(reflections).values({ id: "other", title: "x", writtenOn: "2026-01-01" }).run();
    const file = parseExportFile(JSON.parse(exportBackupString(src)));
    importBackup(dst, file, { replace: true });
    expect(dst.select().from(reflections).all().map((r) => r.id)).toEqual(["r1"]);
  });

  it("restores a milestone chain even when a child was stored before its parent", () => {
    // m0 is inserted first (lower rowid) but nested under m2, which is nested under m1.
    src.insert(milestones).values({ id: "m0", okrId: "o1", text: "Bench 225" }).run();
    src.insert(milestones).values({ id: "m2", okrId: "o1", text: "Bench 185" }).run();
    src.update(milestones).set({ parentId: "m2" }).where(eq(milestones.id, "m0")).run();
    src.update(milestones).set({ parentId: "m1" }).where(eq(milestones.id, "m2")).run();

    const file = parseExportFile(JSON.parse(exportBackupString(src)));
    expect(file.milestones.map((m) => m.id)).toEqual(["m1", "m0", "m2"]); // child before parent in the file
    importBackup(dst, file, { replace: false });
    const parents = Object.fromEntries(dst.select().from(milestones).all().map((m) => [m.id, m.parentId]));
    expect(parents).toEqual({ m1: null, m0: "m2", m2: "m1" });
  });

  it("imports older backups without milestone parents as top level", () => {
    const raw = JSON.parse(exportBackupString(src));
    for (const m of raw.milestones) delete m.parentId;
    importBackup(dst, parseExportFile(raw), { replace: false });
    expect(dst.select().from(milestones).all().every((m) => m.parentId === null)).toBe(true);
  });

  it("rejects foreign files", () => {
    expect(() => parseExportFile({ version: 2 })).toThrow(/Streak backup/);
  });

  it("deleting an OKR unlinks its builds and goals instead of failing", () => {
    src.delete(okrs).run();
    expect(src.select().from(builds).all()[0].okrId).toBeNull();
    expect(src.select().from(goals).all()[0].okrId).toBeNull();
  });

  it("deleting a goal cascades its check-ins", () => {
    src.delete(goals).run();
    expect(src.select().from(checkIns).all()).toHaveLength(0);
  });
});
