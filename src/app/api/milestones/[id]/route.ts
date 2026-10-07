import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { MILESTONE_STATUSES } from "@/lib/constants";
import { milestones, okrs } from "@/lib/db/schema";
import { applyPositionUpdates, okrMilestones } from "@/lib/milestone-writes";
import { isLocked, openDescendants, planDelete } from "@/lib/milestones";
import { definedOnly, fail, readJson } from "@/lib/route-helpers";
import { toMilestone } from "@/lib/serialize";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({ text: z.string().trim().min(1, "is required"), status: z.enum(MILESTONE_STATUSES) })
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

    const changing = patch.status !== undefined && patch.status !== existing.status;
    const siblings = changing ? okrMilestones(db, existing.okrId) : [];

    // Prerequisite lock: can't complete this while its parent isn't done. Reopening and failing are always fine.
    if (changing && patch.status === "done") {
      const byId = new Map(siblings.map((m) => [m.id, m]));
      if (isLocked(existing, byId)) return fail(`Finish “${byId.get(existing.parentId!)!.text}” first.`, 400);
    }

    // Failing is only for time-bound OKRs, and takes everything still open beneath it down too.
    let cascade: string[] = [];
    if (changing && patch.status === "failed") {
      const okr = db.select({ timeframe: okrs.timeframe }).from(okrs).where(eq(okrs.id, existing.okrId)).get();
      if (!okr?.timeframe) return fail("Only OKRs with a timeframe can fail milestones.", 400);
      cascade = openDescendants(siblings, id);
    }

    const resolvedAt = !changing ? existing.resolvedAt : patch.status === "open" ? null : todayIso();
    db.$client.transaction(() => {
      db.update(milestones)
        .set({ ...patch, resolvedAt })
        .where(eq(milestones.id, id))
        .run();
      if (cascade.length > 0) {
        db.update(milestones).set({ status: "failed", resolvedAt }).where(inArray(milestones.id, cascade)).run();
      }
    })();
    return Response.json({ milestone: toMilestone(getRow(id)!), alsoFailed: cascade.length });
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
