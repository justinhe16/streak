import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkIns, goals, okrs } from "@/lib/db/schema";
import { definedOnly, fail, readJson } from "@/lib/route-helpers";
import { toGoal } from "@/lib/serialize";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Frequency and dates are fixed once a goal exists; strict() rejects attempts to send them.
const updateSchema = z
  .object({
    title: z.string().trim().min(1, "is required"),
    description: z.string(),
    okrId: z.string().nullable(),
  })
  .partial()
  .strict();

function getRow(id: string) {
  return db.select().from(goals).where(eq(goals.id, id)).get();
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!getRow(id)) return fail("Goal not found.", 404);

    const parsed = await readJson(request, updateSchema);
    if ("error" in parsed) return parsed.error;
    const patch = definedOnly(parsed.data);
    if (Object.keys(patch).length === 0) return fail("No updatable fields were provided.", 400);

    if (patch.okrId && !db.select({ id: okrs.id }).from(okrs).where(eq(okrs.id, patch.okrId)).get()) {
      return fail("That OKR no longer exists.", 400);
    }

    db.update(goals)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(goals.id, id))
      .run();
    return Response.json({ goal: toGoal(getRow(id)!) });
  } catch (err) {
    console.error("[PATCH /api/goals/:id]", err);
    return fail("Could not update the goal.", 500);
  }
}

/** Hard delete. Check-ins go with it (FK cascade), so past weeks rescore without it. */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!getRow(id)) return fail("Goal not found.", 404);
    const removed = db.select({ n: count() }).from(checkIns).where(eq(checkIns.goalId, id)).get()?.n ?? 0;
    db.delete(goals).where(eq(goals.id, id)).run();
    return Response.json({ ok: true, removedCheckIns: removed });
  } catch (err) {
    console.error("[DELETE /api/goals/:id]", err);
    return fail("Could not delete the goal.", 500);
  }
}
