import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { milestones, okrs } from "@/lib/db/schema";
import { fail, readJson } from "@/lib/route-helpers";
import { toMilestone } from "@/lib/serialize";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({ text: z.string().trim().min(1, "is required") });

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id: okrId } = await params;
    if (!db.select({ id: okrs.id }).from(okrs).where(eq(okrs.id, okrId)).get()) return fail("OKR not found.", 404);

    const parsed = await readJson(request, createSchema);
    if ("error" in parsed) return parsed.error;

    const last = db.select({ p: max(milestones.position) }).from(milestones).where(eq(milestones.okrId, okrId)).get();
    const id = crypto.randomUUID();
    db.insert(milestones)
      .values({ id, okrId, text: parsed.data.text, position: (last?.p ?? -1) + 1 })
      .run();
    const row = db.select().from(milestones).where(eq(milestones.id, id)).get();
    return Response.json({ milestone: toMilestone(row!) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/okrs/:id/milestones]", err);
    return fail("Could not add the milestone.", 500);
  }
}
