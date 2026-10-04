import type { BuildStatus } from "@/lib/constants";

/** Pill colors per build status, shared by the Builds column and the OKR modal. */
export const BUILD_STATUS_STYLES: Record<BuildStatus, string> = {
  active: "bg-primary/12 text-primary",
  idea: "bg-muted text-muted-foreground",
  paused: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  done: "bg-[oklch(0.72_0.18_148/0.16)] text-[oklch(0.5_0.14_148)] dark:text-[oklch(0.8_0.15_148)]",
  cancelled: "bg-muted text-muted-foreground/70 line-through",
};
