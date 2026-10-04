import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { reflections } from "@/lib/db/schema";
import { listReflections } from "@/lib/queries";
import { fail, isoDay, readJson } from "@/lib/route-helpers";
import { toReflection } from "@/lib/serialize";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1, "is required"),
  body: z.string().default(""),
  writtenOn: isoDay,
});

export async function GET() {
  await connection();
  try {
    return Response.json({ reflections: listReflections(db) });
  } catch (err) {
    console.error("[GET /api/reflections]", err);
    return fail("Could not load reflections.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await readJson(request, createSchema);
    if ("error" in parsed) return parsed.error;

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.insert(reflections)
      .values({ id, ...parsed.data, createdAt: now, updatedAt: now })
      .run();
    const row = db.select().from(reflections).where(eq(reflections.id, id)).get();
    return Response.json({ reflection: toReflection(row!) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reflections]", err);
    return fail("Could not save the reflection.", 500);
  }
}
