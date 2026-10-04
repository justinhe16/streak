"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { BuildsPanel } from "@/components/builds/builds-panel";
import { GoalsPanel } from "@/components/goals/goals-panel";
import { GridPanel } from "@/components/grid/grid-panel";
import { percent } from "@/components/grid/week-grid";
import { ReflectionDialogs, ReflectionsPanel, type ReflectionModal } from "@/components/reflections/reflections";
import { useSnapshot } from "@/components/use-snapshot";
import { weekStart } from "@/lib/dates";
import { weekScore } from "@/lib/streak";
import type { Snapshot } from "@/lib/types";
import { PANEL_IDS, PANELS, PANELS_COOKIE, serializePanels, type PanelId } from "./panels";
import { Rail } from "./rail";

type WorkspaceProps = { initial: Snapshot; initialPanels: PanelId[] };

/**
 * The whole app: a floating rail of panel toggles, plus one column per open
 * panel, laid out left to right in a fixed order (grid last) and centered.
 */
export function Workspace({ initial, initialPanels }: WorkspaceProps) {
  const { snapshot, checkInSet, goalSpecs, reflectionDays, reload, setCheckIn } = useSnapshot(initial);
  const [open, setOpen] = useState<PanelId[]>(initialPanels);
  const [reflectionModal, setReflectionModal] = useState<ReflectionModal>(null);

  const update = useCallback((next: (prev: PanelId[]) => PanelId[]) => {
    setOpen((prev) => {
      const value = PANEL_IDS.filter((id) => next(prev).includes(id));
      document.cookie = `${PANELS_COOKIE}=${serializePanels(value)}; path=/; max-age=31536000; samesite=lax`;
      return value;
    });
  }, []);

  const toggle = useCallback(
    (id: PanelId) => update((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])),
    [update],
  );
  const show = (id: PanelId) => update((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const close = (id: PanelId) => () => update((prev) => prev.filter((p) => p !== id));

  // 1–4 toggle panels, unless typing or a modal is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      const id = PANEL_IDS.find((p) => PANELS[p].shortcut === e.key);
      if (id) toggle(id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const badges = useMemo(() => {
    const week = weekScore(goalSpecs, checkInSet, weekStart(snapshot.today), snapshot.today);
    const liveBuilds = snapshot.builds.filter((b) => b.status === "active").length;
    return {
      goals: snapshot.goals.length || undefined,
      builds: liveBuilds ? `${liveBuilds} active` : undefined,
      reflections: snapshot.reflections.length || undefined,
      grid: week.score === null ? undefined : percent(week.score),
    };
  }, [goalSpecs, checkInSet, snapshot]);

  const openReflection = (id: string) => setReflectionModal({ mode: "read", id });

  // `open` is already in PANEL_IDS order, so columns always render in that order.
  const renderPanel: Record<PanelId, () => React.ReactNode> = {
    builds: () => <BuildsPanel builds={snapshot.builds} okrs={snapshot.okrs} reload={reload} onClose={close("builds")} />,
    reflections: () => (
      <ReflectionsPanel reflections={snapshot.reflections} onOpen={setReflectionModal} onClose={close("reflections")} />
    ),
    goals: () => <GoalsPanel snapshot={snapshot} checkIns={checkInSet} reload={reload} onClose={close("goals")} />,
    grid: () => (
      <GridPanel
        snapshot={snapshot}
        checkIns={checkInSet}
        goalSpecs={goalSpecs}
        reflectionDays={reflectionDays}
        setCheckIn={setCheckIn}
        onOpenReflection={openReflection}
        onAddGoal={() => show("goals")}
        onClose={close("grid")}
      />
    ),
  };

  return (
    // Fills the viewport under the header. Scrolls sideways only when the columns don't fit.
    <div className="h-[calc(100dvh-3.25rem)] w-full overflow-x-auto overflow-y-hidden">
      <div className="mx-auto flex h-full w-fit items-center gap-4 px-4 sm:px-6">
        <Rail open={open} onToggle={toggle} badges={badges} />

        {open.map((id) => (
          <Fragment key={id}>{renderPanel[id]()}</Fragment>
        ))}
      </div>

      <ReflectionDialogs
        reflections={snapshot.reflections}
        today={snapshot.today}
        modal={reflectionModal}
        onModal={setReflectionModal}
        reload={reload}
      />
    </div>
  );
}
