import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { checkIns, goals } from "@/lib/db/schema";
import { fail, isoDay, readJson } from "@/lib/route-helpers";
import { isActive } from "@/lib/streak";

export const runtime = "nodejs";

const toggleSchema = z.object({
  goalId: z.string().min(1),
  date: isoDay,
  done: z.boolean(),
});

/** PUT /api/check-ins -- mark a goal done (or not) on a day. Idempotent. */
export async function PUT(request: Request) {
  try {
    const parsed = await readJson(request, toggleSchema);
    if ("error" in parsed) return parsed.error;
    const { goalId, date, done } = parsed.data;

    if (date > todayIso()) return fail("You can't check off a day that hasn't happened yet.", 400);
    const goal = db.select().from(goals).where(eq(goals.id, goalId)).get();
    if (!goal) return fail("Goal not found.", 404);
    if (done && !isActive(goal, date)) return fail("That day is outside the goal's date range.", 400);

    if (done) {
      db.insert(checkIns).values({ goalId, date }).onConflictDoNothing().run();
    } else {
      db.delete(checkIns)
        .where(and(eq(checkIns.goalId, goalId), eq(checkIns.date, date)))
        .run();
    }
    return Response.json({ ok: true, goalId, date, done });
  } catch (err) {
    console.error("[PUT /api/check-ins]", err);
    return fail("Could not save that check-in.", 500);
  }
}
