import { eq } from "drizzle-orm";
import { z } from "zod";
import { BUILD_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { builds, okrs } from "@/lib/db/schema";
import { definedOnly, fail, readJson } from "@/lib/route-helpers";
import { toBuild } from "@/lib/serialize";

export const runtime = "nodejs";

function okrExists(id: string) {
  return db.select({ id: okrs.id }).from(okrs).where(eq(okrs.id, id)).get() !== undefined;
}

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    title: z.string().trim().min(1, "is required"),
    description: z.string(),
    category: z.string().trim(),
    status: z.enum(BUILD_STATUSES),
    okrId: z.string().nullable(),
  })
  .partial()
  .strict();

function getRow(id: string) {
  return db.select().from(builds).where(eq(builds.id, id)).get();
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!getRow(id)) return fail("Build not found.", 404);

    const parsed = await readJson(request, updateSchema);
    if ("error" in parsed) return parsed.error;
    const patch = definedOnly(parsed.data);
    if (Object.keys(patch).length === 0) return fail("No updatable fields were provided.", 400);
    if (patch.okrId && !okrExists(patch.okrId)) return fail("That OKR no longer exists.", 400);

    db.update(builds)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(builds.id, id))
      .run();
    return Response.json({ build: toBuild(getRow(id)!) });
  } catch (err) {
    console.error("[PATCH /api/builds/:id]", err);
    return fail("Could not update the build.", 500);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!getRow(id)) return fail("Build not found.", 404);
    db.delete(builds).where(eq(builds.id, id)).run();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/builds/:id]", err);
    return fail("Could not delete the build.", 500);
  }
}
