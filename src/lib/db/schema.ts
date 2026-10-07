import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

/** Dates are local calendar days as `YYYY-MM-DD`; timestamps are ISO strings. */

export const okrs = sqliteTable("okrs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  /** Free-form, e.g. "2026" or "H1 2027". */
  timeframe: text("timeframe"),
  /** Set by hand: `active` until you call it a `success` or `missed`. */
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const milestones = sqliteTable(
  "milestones",
  {
    id: text("id").primaryKey(),
    okrId: text("okr_id")
      .notNull()
      .references(() => okrs.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** `open`, `done` or `failed` (failing is only offered on OKRs with a timeframe). */
    status: text("status").notNull().default("open"),
    /** Day it was completed or failed; null while open. */
    resolvedAt: text("resolved_at"),
    /** Order among siblings (milestones with the same parent). */
    position: integer("position").notNull().default(0),
    /** Prerequisite: this milestone can't be checked off until its parent is done. Null = top level. */
    parentId: text("parent_id").references((): AnySQLiteColumn => milestones.id, { onDelete: "set null" }),
  },
  (t) => [
    index("milestones_okr_idx").on(t.okrId, t.position),
    index("milestones_parent_idx").on(t.okrId, t.parentId, t.position),
  ],
);

/** Frequency and date range are fixed once created; only text and the OKR link change. */
export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    daysPerWeek: integer("days_per_week").notNull(),
    startDate: text("start_date").notNull(),
    /** Null means perpetual. */
    endDate: text("end_date"),
    okrId: text("okr_id").references(() => okrs.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    check("goals_days_per_week", sql`${t.daysPerWeek} BETWEEN 1 AND 7`),
    check("goals_range", sql`${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate}`),
    index("goals_okr_idx").on(t.okrId),
  ],
);

/** A row means the goal was done that day. */
export const checkIns = sqliteTable(
  "check_ins",
  {
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
  },
  (t) => [primaryKey({ columns: [t.goalId, t.date] }), index("check_ins_date_idx").on(t.date)],
);

export const reflections = sqliteTable(
  "reflections",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    /** Markdown. */
    body: text("body").notNull().default(""),
    writtenOn: text("written_on").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("reflections_written_on_idx").on(t.writtenOn)],
);

export type OkrRow = typeof okrs.$inferSelect;
export type MilestoneRow = typeof milestones.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type CheckInRow = typeof checkIns.$inferSelect;
export type ReflectionRow = typeof reflections.$inferSelect;

/** Side projects. Optionally linked to one OKR (link only; doesn't affect scoring). */
export const builds = sqliteTable(
  "builds",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default(""),
    status: text("status").notNull().default("idea"),
    okrId: text("okr_id").references(() => okrs.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("builds_status_idx").on(t.status), index("builds_okr_idx").on(t.okrId)],
);

export type BuildRow = typeof builds.$inferSelect;
