import type { Db } from "./db";
import { builds, checkIns, goals, milestones, okrs, reflections } from "./db/schema";
import { BACKUP_VERSION, type ParsedExportFile } from "./backup-format";

const TABLES = [
  ["okrs", okrs],
  ["milestones", milestones],
  ["goals", goals],
  ["checkIns", checkIns],
  ["reflections", reflections],
  ["builds", builds],
] as const;

type TableKey = (typeof TABLES)[number][0];

/** The export as text chunks so the route can stream it. */
export function* exportChunks(db: Db): Generator<string, void, undefined> {
  yield `{"app":"streak","version":${BACKUP_VERSION},"exportedAt":${JSON.stringify(new Date().toISOString())}`;
  for (const [key, table] of TABLES) {
    yield `,${JSON.stringify(key)}:[`;
    let first = true;
    for (const row of db.select().from(table).all()) {
      yield (first ? "" : ",") + JSON.stringify(row);
      first = false;
    }
    yield "]";
  }
  yield "}\n";
}

export function exportBackupString(db: Db): string {
  return [...exportChunks(db)].join("");
}

export type ImportResult = {
  mode: "merge" | "replace";
  inserted: Record<TableKey, number>;
  skipped: Record<TableKey, number>;
};

/**
 * Restore a parsed backup in one transaction. `replace` wipes everything first;
 * otherwise rows whose key already exists are left alone (never clobber edits
 * made since the backup).
 */
export function importBackup(db: Db, file: ParsedExportFile, { replace }: { replace: boolean }): ImportResult {
  const inserted = { okrs: 0, milestones: 0, goals: 0, checkIns: 0, reflections: 0, builds: 0 };
  const skipped = { ...inserted };

  db.$client.transaction(() => {
    if (replace) {
      // Children first, though cascades would cover most of it.
      for (const [, table] of [...TABLES].reverse()) db.delete(table).run();
    }
    for (const [key, table] of TABLES) {
      for (const row of file[key]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows were validated against the table's shape
        const res = db.insert(table).values(row as any).onConflictDoNothing().run();
        if (res.changes > 0) inserted[key]++;
        else skipped[key]++;
      }
    }
  })();

  return { mode: replace ? "replace" : "merge", inserted, skipped };
}
