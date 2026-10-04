import { connection } from "next/server";
import { db } from "@/lib/db";
import { loadSnapshot } from "@/lib/queries";
import { fail } from "@/lib/route-helpers";

export const runtime = "nodejs";

/** GET /api/snapshot -- goals, OKRs, check-ins and reflection dates; the grid scores client-side. */
export async function GET() {
  await connection();
  try {
    return Response.json(loadSnapshot(db));
  } catch (err) {
    console.error("[GET /api/snapshot]", err);
    return fail("Could not load your data.", 500);
  }
}
