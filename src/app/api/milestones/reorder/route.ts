import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { milestones } from "@/lib/db/schema";
import { fail, readJson } from "@/lib/route-helpers";

export const runtime = "nodejs";

const reorderSchema = z.object({
  okrId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1),
});

/** PUT /api/milestones/reorder -- `ids` in their new order; must be exactly the OKR's milestones. */
export async function PUT(request: Request) {
  try {
    const parsed = await readJson(request, reorderSchema);
    if ("error" in parsed) return parsed.error;
    const { okrId, ids } = parsed.data;

    const current = db.select({ id: milestones.id }).from(milestones).where(eq(milestones.okrId, okrId)).all();
    const known = new Set(current.map((m) => m.id));
    if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
      return fail("ids must list each of the OKR's milestones exactly once.", 400);
    }

    db.$client.transaction(() => {
      ids.forEach((id, position) => {
        db.update(milestones)
          .set({ position })
          .where(and(eq(milestones.id, id), eq(milestones.okrId, okrId)))
          .run();
      });
    })();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/milestones/reorder]", err);
    return fail("Could not reorder milestones.", 500);
  }
}
