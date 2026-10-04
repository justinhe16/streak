import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { reflections } from "@/lib/db/schema";
import { definedOnly, fail, isoDay, readJson } from "@/lib/route-helpers";
import { toReflection } from "@/lib/serialize";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({ title: z.string().trim().min(1, "is required"), body: z.string(), writtenOn: isoDay })
  .partial()
  .strict();

function getRow(id: string) {
  return db.select().from(reflections).where(eq(reflections.id, id)).get();
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!getRow(id)) return fail("Reflection not found.", 404);

    const parsed = await readJson(request, updateSchema);
    if ("error" in parsed) return parsed.error;
    const patch = definedOnly(parsed.data);
    if (Object.keys(patch).length === 0) return fail("No updatable fields were provided.", 400);

    db.update(reflections)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(reflections.id, id))
      .run();
    return Response.json({ reflection: toReflection(getRow(id)!) });
  } catch (err) {
    console.error("[PATCH /api/reflections/:id]", err);
    return fail("Could not update the reflection.", 500);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!getRow(id)) return fail("Reflection not found.", 404);
    db.delete(reflections).where(eq(reflections.id, id)).run();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/reflections/:id]", err);
    return fail("Could not delete the reflection.", 500);
  }
}
