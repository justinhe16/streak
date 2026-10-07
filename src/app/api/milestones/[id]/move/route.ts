import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { milestones } from "@/lib/db/schema";
import { applyPositionUpdates, okrMilestones } from "@/lib/milestone-writes";
import { planMove } from "@/lib/milestones";
import { fail, readJson } from "@/lib/route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const moveSchema = z.object({ direction: z.enum(["up", "down", "indent", "outdent"]) });

/** POST /api/milestones/:id/move -- outliner-style move: up/down among siblings, indent/outdent a level. */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const row = db.select().from(milestones).where(eq(milestones.id, id)).get();
    if (!row) return fail("Milestone not found.", 404);

    const parsed = await readJson(request, moveSchema);
    if ("error" in parsed) return parsed.error;

    const plan = planMove(okrMilestones(db, row.okrId), id, parsed.data.direction);
    if ("error" in plan) return fail(plan.error, 400);

    db.$client.transaction(() => applyPositionUpdates(db, plan.updates))();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/milestones/:id/move]", err);
    return fail("Could not move the milestone.", 500);
  }
}
