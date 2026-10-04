import { eq } from "drizzle-orm";
import { z } from "zod";
import { OKR_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { okrs } from "@/lib/db/schema";
import { getOkr } from "@/lib/queries";
import { definedOnly, fail, readJson } from "@/lib/route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    title: z.string().trim().min(1, "is required"),
    description: z.string(),
    timeframe: z.string().trim().nullable(),
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

    db.update(okrs)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(okrs.id, id))
      .run();
    return Response.json({ okr: getOkr(db, id) });
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
