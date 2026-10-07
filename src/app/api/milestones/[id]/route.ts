import { eq } from "drizzle-orm";
import { z } from "zod";
import { todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { milestones } from "@/lib/db/schema";
import { applyPositionUpdates, okrMilestones } from "@/lib/milestone-writes";
import { isLocked, planDelete } from "@/lib/milestones";
import { definedOnly, fail, readJson } from "@/lib/route-helpers";
import { toMilestone } from "@/lib/serialize";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({ text: z.string().trim().min(1, "is required"), done: z.boolean() })
  .partial()
  .strict();

function getRow(id: string) {
  return db.select().from(milestones).where(eq(milestones.id, id)).get();
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = getRow(id);
    if (!existing) return fail("Milestone not found.", 404);

    const parsed = await readJson(request, updateSchema);
    if ("error" in parsed) return parsed.error;
    const patch = definedOnly(parsed.data);
    if (Object.keys(patch).length === 0) return fail("No updatable fields were provided.", 400);

    // Prerequisite lock: can't check this off while its parent isn't done. Unchecking is always fine.
    if (patch.done === true && !existing.done) {
      const byId = new Map(okrMilestones(db, existing.okrId).map((m) => [m.id, m]));
      if (isLocked(existing, byId)) return fail(`Finish “${byId.get(existing.parentId!)!.text}” first.`, 400);
    }

    const doneAt =
      patch.done === undefined ? existing.doneAt : patch.done ? (existing.doneAt ?? todayIso()) : null;
    db.update(milestones)
      .set({ ...patch, doneAt })
      .where(eq(milestones.id, id))
      .run();
    return Response.json({ milestone: toMilestone(getRow(id)!) });
  } catch (err) {
    console.error("[PATCH /api/milestones/:id]", err);
    return fail("Could not update the milestone.", 500);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = getRow(id);
    if (!existing) return fail("Milestone not found.", 404);
    // Its children move up into its slot rather than losing their place.
    const updates = planDelete(okrMilestones(db, existing.okrId), id);
    db.$client.transaction(() => {
      applyPositionUpdates(db, updates);
      db.delete(milestones).where(eq(milestones.id, id)).run();
    })();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/milestones/:id]", err);
    return fail("Could not delete the milestone.", 500);
  }
}
