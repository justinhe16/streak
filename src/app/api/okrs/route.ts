import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { milestones, okrs } from "@/lib/db/schema";
import { getOkr, listOkrs } from "@/lib/queries";
import { fail, readJson } from "@/lib/route-helpers";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1, "is required"),
  description: z.string().default(""),
  timeframe: z.string().trim().nullable().default(null),
  milestones: z.array(z.string().trim().min(1)).default([]),
});

export async function GET() {
  await connection();
  try {
    return Response.json({ okrs: listOkrs(db) });
  } catch (err) {
    console.error("[GET /api/okrs]", err);
    return fail("Could not load OKRs.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await readJson(request, createSchema);
    if ("error" in parsed) return parsed.error;
    const { milestones: texts, ...input } = parsed.data;

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.$client.transaction(() => {
      db.insert(okrs)
        .values({ id, ...input, timeframe: input.timeframe || null, createdAt: now, updatedAt: now })
        .run();
      texts.forEach((text, position) => {
        db.insert(milestones).values({ id: crypto.randomUUID(), okrId: id, text, position }).run();
      });
    })();

    return Response.json({ okr: getOkr(db, id) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/okrs]", err);
    return fail("Could not create the OKR.", 500);
  }
}
