/**
 * One-time backfill for OKR dates.
 *
 *   npm run db:backfill-okr-dates                 # dry run: print what would change
 *   npm run db:backfill-okr-dates -- --apply      # snapshot the DB, then write
 *   npm run db:backfill-okr-dates -- --db <path>  # run against another file
 *   npm run db:backfill-okr-dates -- --clear-labels
 *        # also clear timeframe labels that were just a date range, so the UI
 *        # shows the formatted dates instead
 *
 * For each OKR without dates, its free-text timeframe is parsed into a start
 * and end ("2026", "Q4 2026", "Oct 1, 2026 - Oct 12, 2026", ...). Then each
 * linked goal that ends before its OKR is extended to the OKR's end. Starts are
 * never moved, and perpetual goals are left alone.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createDb } from "../src/lib/db/create";
import { goals, okrs } from "../src/lib/db/schema";
import { parseTimeframe } from "../src/lib/goal-dates";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const clearLabels = process.argv.includes("--clear-labels");
  // Resolved here rather than imported from src/lib/db, which opens (and migrates) the real DB on import.
  const file = path.resolve(arg("--db") ?? process.env.DATABASE_PATH ?? "data/streak.db");
  const db = createDb(file);

  const okrUpdates: { id: string; startDate: string | null; endDate: string | null; clearLabel: boolean }[] = [];
  const goalUpdates: { id: string; endDate: string }[] = [];

  console.log(`${apply ? "Applying" : "Dry run"} on ${file}\n`);

  for (const okr of db.select().from(okrs).all()) {
    let { startDate, endDate } = okr;
    let clearLabel = false;
    if (startDate === null && endDate === null && okr.timeframe) {
      const parsed = parseTimeframe(okr.timeframe);
      if (parsed) {
        ({ startDate, endDate } = parsed);
        // A label like "Oct 1, 2026 - Oct 12, 2026" is just the range again; "Q4 2026" is worth keeping.
        clearLabel = clearLabels && /\d{1,2}\b.*\d{4}/.test(okr.timeframe) && !/^[QH]\d/i.test(okr.timeframe);
        okrUpdates.push({ id: okr.id, startDate, endDate, clearLabel });
        console.log(`OKR "${okr.title}"`);
        console.log(`  timeframe "${okr.timeframe}" → ${startDate} … ${endDate}${clearLabel ? " (label cleared)" : ""}`);
      } else {
        console.log(`OKR "${okr.title}": timeframe "${okr.timeframe}" not recognized, left as text`);
      }
    }

    if (endDate === null) continue;
    for (const g of db.select().from(goals).where(eq(goals.okrId, okr.id)).all()) {
      if (g.endDate !== null && g.endDate < endDate) {
        goalUpdates.push({ id: g.id, endDate });
        console.log(`  goal "${g.title}": ${g.startDate} … ${g.endDate} → ${g.startDate} … ${endDate}`);
      }
    }
  }

  if (okrUpdates.length === 0 && goalUpdates.length === 0) {
    console.log("Nothing to change.");
    return;
  }
  if (!apply) {
    console.log(`\n${okrUpdates.length} OKR(s) and ${goalUpdates.length} goal(s) would change. Re-run with --apply to write.`);
    return;
  }

  // Safety net: a consistent snapshot before writing anything.
  const dir = path.resolve("./backups");
  fs.mkdirSync(dir, { recursive: true });
  const snapshot = path.join(dir, `streak-pre-okr-dates-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  await db.$client.backup(snapshot);
  console.log(`\nSnapshot saved to ${snapshot}`);

  const now = new Date().toISOString();
  db.$client.transaction(() => {
    for (const u of okrUpdates) {
      db.update(okrs)
        .set({ startDate: u.startDate, endDate: u.endDate, ...(u.clearLabel ? { timeframe: null } : {}), updatedAt: now })
        .where(eq(okrs.id, u.id))
        .run();
    }
    for (const u of goalUpdates) {
      db.update(goals).set({ endDate: u.endDate, updatedAt: now }).where(eq(goals.id, u.id)).run();
    }
  })();
  console.log(`Updated ${okrUpdates.length} OKR(s) and ${goalUpdates.length} goal(s).`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
