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

type BackupMilestone = ParsedExportFile["milestones"][number];

/**
 * Milestones ordered so each parent is inserted before its children (the
 * self-reference would fail otherwise). A parent that's in neither the file nor
 * the database is dropped, leaving the child at the top level.
 */
function parentsFirst(db: Db, rows: readonly BackupMilestone[]): BackupMilestone[] {
  const inFile = new Map(rows.map((r) => [r.id, r]));
  const inDb = new Set(db.select({ id: milestones.id }).from(milestones).all().map((r) => r.id));
  const out: BackupMilestone[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();

  function place(r: BackupMilestone) {
    if (placed.has(r.id)) return;
    let parentId = r.parentId;
    if (parentId !== null && inFile.has(parentId) && !visiting.has(parentId)) {
      visiting.add(r.id);
      place(inFile.get(parentId)!);
      visiting.delete(r.id);
    } else if (parentId !== null && !inDb.has(parentId)) {
      parentId = null; // missing, or part of a corrupt cycle
    }
    placed.add(r.id);
    out.push({ ...r, parentId });
  }

  rows.forEach(place);
  return out;
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
      const rows = key === "milestones" ? parentsFirst(db, file.milestones) : file[key];
      for (const row of rows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows were validated against the table's shape
        const res = db.insert(table).values(row as any).onConflictDoNothing().run();
        if (res.changes > 0) inserted[key]++;
        else skipped[key]++;
      }
    }
  })();

  return { mode: replace ? "replace" : "merge", inserted, skipped };
}
