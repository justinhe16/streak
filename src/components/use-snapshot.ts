"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { checkInKey, type GoalSpec } from "@/lib/streak";
import type { Snapshot } from "@/lib/types";

/**
 * Client copy of the server snapshot. Scoring is derived from it, so a check-in
 * can update the grid optimistically and roll back if the save fails.
 */
export function useSnapshot(initial: Snapshot) {
  const [snapshot, setSnapshot] = useState(initial);

  const checkInSet = useMemo(
    () => new Set(snapshot.checkIns.map((c) => checkInKey(c.goalId, c.date))),
    [snapshot.checkIns],
  );
  const goalSpecs: GoalSpec[] = snapshot.goals;
  const reflectionDays = useMemo(() => new Set(snapshot.reflections.map((r) => r.writtenOn)), [snapshot.reflections]);

  const reload = useCallback(async () => {
    try {
      setSnapshot(await api.snapshot());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not refresh.");
    }
  }, []);

  const setCheckIn = useCallback(async (goalId: string, date: string, done: boolean) => {
    const apply = (on: boolean) =>
      setSnapshot((s) => ({
        ...s,
        checkIns: on
          ? [...s.checkIns.filter((c) => !(c.goalId === goalId && c.date === date)), { goalId, date }]
          : s.checkIns.filter((c) => !(c.goalId === goalId && c.date === date)),
      }));
    apply(done);
    try {
      await api.setCheckIn(goalId, date, done);
    } catch (err) {
      apply(!done);
      toast.error(err instanceof Error ? err.message : "Could not save that check-in.");
    }
  }, []);

  return { snapshot, checkInSet, goalSpecs, reflectionDays, reload, setCheckIn };
}
