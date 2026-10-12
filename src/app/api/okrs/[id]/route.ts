import { eq } from "drizzle-orm";
import { z } from "zod";
import { OKR_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { goals, okrs } from "@/lib/db/schema";
import { todayIso } from "@/lib/dates";
import { followOkrDates } from "@/lib/goal-dates";
import { getOkr } from "@/lib/queries";
import { definedOnly, fail, isoDay, readJson } from "@/lib/route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    title: z.string().trim().min(1, "is required"),
    description: z.string(),
    timeframe: z.string().trim().nullable(),
    startDate: isoDay.nullable(),
    endDate: isoDay.nullable(),
    status: z.enum(OKR_STATUSES),
  })
  .partial()
  .strict();

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!getOkr(db, id)) return fail("OKR not found.", 404);

    const parsed = await readJson(request, updateSchema);
    if ("error" in parsed) return parsed.error;
    const patch = definedOnly(parsed.data);
    if (Object.keys(patch).length === 0) return fail("No updatable fields were provided.", 400);
    if (patch.timeframe === "") patch.timeframe = null;

    const before = db.select().from(okrs).where(eq(okrs.id, id)).get()!;
    const after = {
      startDate: patch.startDate === undefined ? before.startDate : patch.startDate,
      endDate: patch.endDate === undefined ? before.endDate : patch.endDate,
    };
    if (after.startDate && after.endDate && after.endDate < after.startDate) {
      return fail("endDate: must be on or after the start date", 400);
    }

    // Linked goals that were aligned with the old dates follow the new ones.
    const linked = db.select().from(goals).where(eq(goals.okrId, id)).all();
    const moves = followOkrDates(linked, before, after, todayIso());
    const now = new Date().toISOString();
    db.$client.transaction(() => {
      db.update(okrs)
        .set({ ...patch, updatedAt: now })
        .where(eq(okrs.id, id))
        .run();
      for (const m of moves) {
        db.update(goals)
          .set({ startDate: m.startDate, endDate: m.endDate, updatedAt: now })
          .where(eq(goals.id, m.id))
          .run();
      }
    })();
    return Response.json({ okr: getOkr(db, id), movedGoals: moves.length });
  } catch (err) {
    console.error("[PATCH /api/okrs/:id]", err);
    return fail("Could not update the OKR.", 500);
  }
}

/** Milestones go with it; linked goals are kept and simply unlinked (FK set null). */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!getOkr(db, id)) return fail("OKR not found.", 404);
    db.delete(okrs).where(eq(okrs.id, id)).run();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/okrs/:id]", err);
    return fail("Could not delete the OKR.", 500);
  }
}
