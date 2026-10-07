import { BUILD_STATUSES, OKR_STATUSES, type BuildStatus, type OkrStatus } from "./constants";
import type { BuildRow, GoalRow, MilestoneRow, OkrRow, ReflectionRow } from "./db/schema";
import type { Build, Goal, Milestone, Okr, Reflection } from "./types";

export function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    daysPerWeek: row.daysPerWeek,
    startDate: row.startDate,
    endDate: row.endDate,
    okrId: row.okrId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    okrId: row.okrId,
    text: row.text,
    done: row.done,
    doneAt: row.doneAt,
    position: row.position,
    parentId: row.parentId,
  };
}

export function toOkr(row: OkrRow, milestones: MilestoneRow[]): Okr {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    timeframe: row.timeframe,
    status: (OKR_STATUSES as readonly string[]).includes(row.status) ? (row.status as OkrStatus) : "active",
    milestones: milestones
      .filter((m) => m.okrId === row.id)
      .sort((a, b) => a.position - b.position)
      .map(toMilestone),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toReflection(row: ReflectionRow): Reflection {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    writtenOn: row.writtenOn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toBuild(row: BuildRow): Build {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: (BUILD_STATUSES as readonly string[]).includes(row.status) ? (row.status as BuildStatus) : "idea",
    okrId: row.okrId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
