import type { BuildStatus, OkrStatus } from "./constants";

/** Wire shapes returned by the API and consumed by the UI. */

export type Goal = {
  id: string;
  title: string;
  description: string;
  daysPerWeek: number;
  startDate: string;
  /** Null means perpetual. */
  endDate: string | null;
  okrId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Milestone = {
  id: string;
  okrId: string;
  text: string;
  done: boolean;
  doneAt: string | null;
  /** Order among siblings. */
  position: number;
  /** Prerequisite milestone; this one is locked until it's done. Null = top level. */
  parentId: string | null;
};

export type Okr = {
  id: string;
  title: string;
  description: string;
  timeframe: string | null;
  status: OkrStatus;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
};

export type Reflection = {
  id: string;
  title: string;
  body: string;
  writtenOn: string;
  createdAt: string;
  updatedAt: string;
};

export type ReflectionSummary = Pick<Reflection, "id" | "title" | "writtenOn">;

export type CheckIn = { goalId: string; date: string };

/** Everything the workspace renders from; scoring runs client-side. */
export type Snapshot = {
  today: string;
  goals: Goal[];
  okrs: Okr[];
  checkIns: CheckIn[];
  reflections: Reflection[];
  builds: Build[];
};

export type CreateGoalInput = {
  title: string;
  description?: string;
  daysPerWeek: number;
  startDate: string;
  endDate?: string | null;
  okrId?: string | null;
};

export type UpdateGoalInput = Partial<Pick<Goal, "title" | "description" | "okrId">>;

export type CreateOkrInput = {
  title: string;
  description?: string;
  timeframe?: string | null;
  milestones?: string[];
};

export type UpdateOkrInput = Partial<Pick<Okr, "title" | "description" | "timeframe" | "status">>;

export type UpdateMilestoneInput = Partial<Pick<Milestone, "text" | "done">>;

export type CreateReflectionInput = { title: string; body?: string; writtenOn: string };

export type UpdateReflectionInput = Partial<CreateReflectionInput>;

export type Build = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: BuildStatus;
  /** Optional link; doesn't affect OKR scoring. */
  okrId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBuildInput = {
  title: string;
  description?: string;
  category?: string;
  status?: BuildStatus;
  okrId?: string | null;
};

export type UpdateBuildInput = Partial<Pick<Build, "title" | "description" | "category" | "status" | "okrId">>;
