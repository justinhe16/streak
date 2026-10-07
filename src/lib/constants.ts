export const OKR_STATUSES = ["active", "success", "missed"] as const;
export type OkrStatus = (typeof OKR_STATUSES)[number];

export const OKR_STATUS_LABELS: Record<OkrStatus, string> = {
  active: "Active",
  success: "Success",
  missed: "Missed",
};

export const MILESTONE_STATUSES = ["open", "done", "failed"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/** Listed in display order on the Builds tab. */
export const BUILD_STATUSES = ["active", "idea", "paused", "done", "cancelled"] as const;
export type BuildStatus = (typeof BUILD_STATUSES)[number];

export const BUILD_STATUS_LABELS: Record<BuildStatus, string> = {
  active: "Active",
  idea: "Idea",
  paused: "Paused",
  done: "Done",
  cancelled: "Cancelled",
};
