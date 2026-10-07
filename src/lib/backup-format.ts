import { z } from "zod";
import { BUILD_STATUSES, MILESTONE_STATUSES, OKR_STATUSES } from "./constants";
import { isIsoDay } from "./dates";

/** Shape of the file written by GET /api/export. Bump on any incompatible change. */
export const BACKUP_VERSION = 1;

const day = z.string().refine(isIsoDay, "must be a date as YYYY-MM-DD");
const stamp = z.string().min(1);

const okr = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  timeframe: z.string().nullable(),
  status: z.enum(OKR_STATUSES),
  createdAt: stamp,
  updatedAt: stamp,
});

/** Older backups stored `done` + `doneAt`; map them onto `status` + `resolvedAt`. */
function upgradeMilestone(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || "status" in raw) return raw;
  const { done, doneAt, ...rest } = raw as { done?: unknown; doneAt?: unknown };
  return { ...rest, status: done === true ? "done" : "open", resolvedAt: doneAt ?? null };
}

const milestoneShape = z.object({
  id: z.string().min(1),
  okrId: z.string().min(1),
  text: z.string(),
  status: z.enum(MILESTONE_STATUSES),
  resolvedAt: day.nullable(),
  position: z.number().int(),
  // Added later; older backups have every milestone at the top level.
  parentId: z.string().nullable().default(null),
});

const milestone = z.preprocess(upgradeMilestone, milestoneShape);

const goal = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string(),
    daysPerWeek: z.number().int().min(1).max(7),
    startDate: day,
    endDate: day.nullable(),
    okrId: z.string().nullable(),
    createdAt: stamp,
    updatedAt: stamp,
  })
  .refine((g) => g.endDate === null || g.endDate >= g.startDate, { message: "end date before start date" });

const checkIn = z.object({ goalId: z.string().min(1), date: day });

const reflection = z.object({
  id: z.string().min(1),
  title: z.string(),
  body: z.string(),
  writtenOn: day,
  createdAt: stamp,
  updatedAt: stamp,
});

const build = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  status: z.enum(BUILD_STATUSES),
  // Added later; older backups have no link.
  okrId: z.string().nullable().default(null),
  createdAt: stamp,
  updatedAt: stamp,
});

const exportFile = z.object({
  app: z.literal("streak"),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  okrs: z.array(okr),
  milestones: z.array(milestone),
  goals: z.array(goal),
  checkIns: z.array(checkIn),
  reflections: z.array(reflection),
  // Added after v1 shipped; older files simply have none.
  builds: z.array(build).default([]),
});

export type ParsedExportFile = z.infer<typeof exportFile>;

/** Validate an uploaded backup. Checks the version first so an old/foreign file gets a useful message. */
export function parseExportFile(raw: unknown): ParsedExportFile {
  if (!raw || typeof raw !== "object") throw new Error("Backup must be a JSON object.");
  const head = raw as { app?: unknown; version?: unknown };
  if (head.app !== "streak") throw new Error("This doesn't look like a Streak backup.");
  if (head.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version ${String(head.version)} (expected ${BACKUP_VERSION}).`);
  }
  const parsed = exportFile.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid backup at ${issue.path.join(".") || "root"}: ${issue.message}`);
  }
  return parsed.data;
}
