import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "./db";
import { builds, checkIns, goals, milestones, okrs, reflections } from "./db/schema";
import { todayIso } from "./dates";
import { toBuild, toGoal, toOkr, toReflection } from "./serialize";
import type { Build, Okr, Reflection, Snapshot } from "./types";

export function listOkrs(db: Db): Okr[] {
  const ms = db.select().from(milestones).all();
  return db
    .select()
    .from(okrs)
    .orderBy(asc(okrs.createdAt))
    .all()
    .map((row) => toOkr(row, ms));
}

export function getOkr(db: Db, id: string): Okr | null {
  const row = db.select().from(okrs).where(eq(okrs.id, id)).get();
  if (!row) return null;
  return toOkr(row, db.select().from(milestones).where(eq(milestones.okrId, id)).all());
}

export function listReflections(db: Db): Reflection[] {
  return db
    .select()
    .from(reflections)
    .orderBy(desc(reflections.writtenOn), desc(reflections.createdAt))
    .all()
    .map(toReflection);
}

export function loadSnapshot(db: Db): Snapshot {
  return {
    today: todayIso(),
    goals: db.select().from(goals).orderBy(asc(goals.startDate), asc(goals.createdAt)).all().map(toGoal),
    okrs: listOkrs(db),
    checkIns: db.select().from(checkIns).all(),
    reflections: listReflections(db),
    builds: listBuilds(db),
  };
}

export function listBuilds(db: Db): Build[] {
  return db.select().from(builds).orderBy(desc(builds.updatedAt)).all().map(toBuild);
}
