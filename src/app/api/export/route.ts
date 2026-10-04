import { connection } from "next/server";
import { db } from "@/lib/db";
import { exportChunks } from "@/lib/backup-io";

export const runtime = "nodejs";

/** GET /api/export -- the whole database as one JSON file, streamed in batches. */
export async function GET() {
  await connection();
  const chunks = exportChunks(db);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      // Batch small chunks so we don't enqueue one tiny buffer per row.
      let buf = "";
      while (buf.length < 64 * 1024) {
        const next = chunks.next();
        if (next.done) {
          if (buf) controller.enqueue(encoder.encode(buf));
          controller.close();
          return;
        }
        buf += next.value;
      }
      controller.enqueue(encoder.encode(buf));
    },
    cancel() {
      chunks.return(undefined);
    },
  });

  const date = new Date().toISOString().slice(0, 10);

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="streak-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
