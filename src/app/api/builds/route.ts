import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { BUILD_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { builds, okrs } from "@/lib/db/schema";
import { listBuilds } from "@/lib/queries";
import { fail, readJson } from "@/lib/route-helpers";
import { toBuild } from "@/lib/serialize";

export const runtime = "nodejs";

function okrExists(id: string) {
  return db.select({ id: okrs.id }).from(okrs).where(eq(okrs.id, id)).get() !== undefined;
}

const createSchema = z.object({
  title: z.string().trim().min(1, "is required"),
  description: z.string().default(""),
  category: z.string().trim().default(""),
  status: z.enum(BUILD_STATUSES).default("idea"),
  okrId: z.string().nullable().default(null),
});

export async function GET() {
  await connection();
  try {
    return Response.json({ builds: listBuilds(db) });
  } catch (err) {
    console.error("[GET /api/builds]", err);
    return fail("Could not load builds.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await readJson(request, createSchema);
    if ("error" in parsed) return parsed.error;
    if (parsed.data.okrId && !okrExists(parsed.data.okrId)) return fail("That OKR no longer exists.", 400);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.insert(builds)
      .values({ id, ...parsed.data, createdAt: now, updatedAt: now })
      .run();
    const row = db.select().from(builds).where(eq(builds.id, id)).get();
    return Response.json({ build: toBuild(row!) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/builds]", err);
    return fail("Could not create the build.", 500);
  }
}
