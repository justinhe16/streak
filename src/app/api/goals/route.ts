import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { goals, okrs } from "@/lib/db/schema";
import { fail, isoDay, readJson } from "@/lib/route-helpers";
import { toGoal } from "@/lib/serialize";

export const runtime = "nodejs";

const createSchema = z
  .object({
    title: z.string().trim().min(1, "is required"),
    description: z.string().default(""),
    daysPerWeek: z.number().int().min(1).max(7),
    startDate: isoDay,
    endDate: isoDay.nullable().default(null),
    okrId: z.string().nullable().default(null),
  })
  .refine((g) => g.endDate === null || g.endDate >= g.startDate, {
    path: ["endDate"],
    message: "must be on or after the start date",
  });

export async function GET() {
  await connection();
  try {
    return Response.json({ goals: db.select().from(goals).all().map(toGoal) });
  } catch (err) {
    console.error("[GET /api/goals]", err);
    return fail("Could not load goals.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await readJson(request, createSchema);
    if ("error" in parsed) return parsed.error;
    const input = parsed.data;

    if (input.okrId && !db.select({ id: okrs.id }).from(okrs).where(eq(okrs.id, input.okrId)).get()) {
      return fail("That OKR no longer exists.", 400);
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.insert(goals)
      .values({ id, ...input, createdAt: now, updatedAt: now })
      .run();

    const row = db.select().from(goals).where(eq(goals.id, id)).get();
    return Response.json({ goal: toGoal(row!) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/goals]", err);
    return fail("Could not create the goal.", 500);
  }
}
