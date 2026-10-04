import { HammerIcon, LayoutGridIcon, NotebookPenIcon, TargetIcon, type LucideIcon } from "lucide-react";

/** Display order, left to right. The grid always sits last. */
export const PANEL_IDS = ["builds", "reflections", "goals", "grid"] as const;
export type PanelId = (typeof PANEL_IDS)[number];

export const PANELS: Record<PanelId, { label: string; icon: LucideIcon; shortcut: string }> = {
  builds: { label: "Builds", icon: HammerIcon, shortcut: "1" },
  reflections: { label: "Reflections", icon: NotebookPenIcon, shortcut: "2" },
  goals: { label: "Goals", icon: TargetIcon, shortcut: "3" },
  grid: { label: "Grid", icon: LayoutGridIcon, shortcut: "4" },
};

/** Which panels are open is kept in a cookie so the server renders the same layout (no flash). */
export const PANELS_COOKIE = "streak-panels";
export const DEFAULT_PANELS: PanelId[] = ["grid"];

export function parsePanels(raw: string | undefined): PanelId[] {
  if (raw === undefined) return DEFAULT_PANELS;
  const wanted = new Set(raw.split(","));
  return PANEL_IDS.filter((id) => wanted.has(id));
}

export function serializePanels(open: readonly PanelId[]): string {
  return PANEL_IDS.filter((id) => open.includes(id)).join(",");
}
