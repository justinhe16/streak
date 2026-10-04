import { eq } from "drizzle-orm";
import { z } from "zod";
import { todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { milestones } from "@/lib/db/schema";
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
    if (!getRow(id)) return fail("Milestone not found.", 404);
    db.delete(milestones).where(eq(milestones.id, id)).run();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/milestones/:id]", err);
    return fail("Could not delete the milestone.", 500);
  }
}
