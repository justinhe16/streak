import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { milestones } from "./db/schema";
import type { PositionUpdate } from "./milestones";

export function okrMilestones(db: Db, okrId: string) {
  return db.select().from(milestones).where(eq(milestones.okrId, okrId)).all();
}

/** Write planned parent/position changes. Call inside a transaction. */
export function applyPositionUpdates(db: Db, updates: readonly PositionUpdate[]) {
  for (const u of updates) {
    db.update(milestones).set({ parentId: u.parentId, position: u.position }).where(eq(milestones.id, u.id)).run();
  }
}
