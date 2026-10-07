/**
 * Milestone dependency tree. Each milestone has at most one parent (a
 * prerequisite) and a `position` among its siblings. Pure functions over plain
 * rows, shared by the API (to plan writes) and the UI (to render the tree).
 */

import type { MilestoneStatus } from "./constants";

export type MilestoneNode = {
  id: string;
  parentId: string | null;
  position: number;
  status: MilestoneStatus | string;
  text: string;
};

export type FlatMilestone<T extends MilestoneNode> = {
  milestone: T;
  depth: number;
  parent: T | null;
  /** Index among its siblings. */
  index: number;
  siblingCount: number;
};

export type MoveDirection = "up" | "down" | "indent" | "outdent";

export type PositionUpdate = { id: string; parentId: string | null; position: number };

/** Parent id as the tree sees it: a dangling reference counts as top level. */
function parentKey(m: MilestoneNode, byId: ReadonlyMap<string, MilestoneNode>): string | null {
  return m.parentId !== null && byId.has(m.parentId) && m.parentId !== m.id ? m.parentId : null;
}

function byPosition(a: MilestoneNode, b: MilestoneNode) {
  return a.position - b.position || a.id.localeCompare(b.id);
}

/** Sibling groups keyed by parent id (null = top level), each sorted by position. */
function groups<T extends MilestoneNode>(ms: readonly T[]) {
  const byId = new Map(ms.map((m) => [m.id, m]));
  const children = new Map<string | null, T[]>();
  for (const m of ms) {
    const key = parentKey(m, byId);
    const list = children.get(key) ?? [];
    list.push(m);
    children.set(key, list);
  }
  for (const list of children.values()) list.sort(byPosition);
  return { byId, children };
}

/** Depth-first rows for rendering. Anything unreachable (a corrupt cycle) is shown at top level. */
export function flattenTree<T extends MilestoneNode>(ms: readonly T[]): FlatMilestone<T>[] {
  const { byId, children } = groups(ms);
  const out: FlatMilestone<T>[] = [];
  const seen = new Set<string>();

  function walk(key: string | null, depth: number) {
    const list = children.get(key) ?? [];
    list.forEach((m, index) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      out.push({ milestone: m, depth, parent: key ? (byId.get(key) ?? null) : null, index, siblingCount: list.length });
      walk(m.id, depth + 1);
    });
  }

  walk(null, 0);
  const stray = ms.filter((m) => !seen.has(m.id)).sort(byPosition);
  stray.forEach((m, i) => out.push({ milestone: m, depth: 0, parent: null, index: i, siblingCount: stray.length }));
  return out;
}

/** An open milestone is locked while its prerequisite isn't done (including when it failed). */
export function isLocked(m: MilestoneNode, byId: ReadonlyMap<string, MilestoneNode>): boolean {
  if (m.status !== "open") return false;
  const key = parentKey(m, byId);
  return key !== null && byId.get(key)!.status !== "done";
}

/** Ids of every descendant of `id` that's still open (for cascading a failure down the chain). */
export function openDescendants(ms: readonly MilestoneNode[], id: string): string[] {
  const { children } = groups(ms);
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const stack = [...(children.get(id) ?? [])];
  while (stack.length) {
    const m = stack.pop()!;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    if (m.status === "open") out.push(m.id);
    stack.push(...(children.get(m.id) ?? []));
  }
  return out;
}

/** True if making `newParentId` the parent of `id` would create a loop. */
export function wouldCycle(ms: readonly MilestoneNode[], id: string, newParentId: string | null): boolean {
  const byId = new Map(ms.map((m) => [m.id, m]));
  let cur = newParentId;
  const seen = new Set<string>();
  while (cur !== null && !seen.has(cur)) {
    if (cur === id) return true;
    seen.add(cur);
    const node = byId.get(cur);
    cur = node ? parentKey(node, byId) : null;
  }
  return false;
}

/** Updates for rows whose parent or position differ from the planned layout. */
function diff(
  byId: ReadonlyMap<string, MilestoneNode>,
  layout: ReadonlyMap<string | null, readonly MilestoneNode[]>,
): PositionUpdate[] {
  const updates: PositionUpdate[] = [];
  for (const [parentId, list] of layout) {
    list.forEach((m, position) => {
      const before = byId.get(m.id)!;
      if (before.parentId !== parentId || before.position !== position) {
        updates.push({ id: m.id, parentId, position });
      }
    });
  }
  return updates;
}

/** Plan an outliner-style move. Every touched sibling group is renumbered 0..n. */
export function planMove(
  ms: readonly MilestoneNode[],
  id: string,
  direction: MoveDirection,
): { updates: PositionUpdate[] } | { error: string } {
  const { byId, children } = groups(ms);
  const node = byId.get(id);
  if (!node) return { error: "Milestone not found." };
  const key = parentKey(node, byId);
  const siblings = [...(children.get(key) ?? [])];
  const index = siblings.findIndex((m) => m.id === id);
  const layout = new Map<string | null, MilestoneNode[]>();

  switch (direction) {
    case "up":
    case "down": {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= siblings.length) {
        return { error: direction === "up" ? "Already first." : "Already last." };
      }
      [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
      layout.set(key, siblings);
      break;
    }
    case "indent": {
      if (index === 0) return { error: "Nothing above to nest under." };
      const newParent = siblings[index - 1];
      siblings.splice(index, 1);
      layout.set(key, siblings);
      layout.set(newParent.id, [...(children.get(newParent.id) ?? []), node]);
      break;
    }
    case "outdent": {
      if (key === null) return { error: "Already at the top level." };
      const parent = byId.get(key)!;
      const grandKey = parentKey(parent, byId);
      siblings.splice(index, 1);
      const outer = [...(children.get(grandKey) ?? [])];
      outer.splice(outer.findIndex((m) => m.id === parent.id) + 1, 0, node);
      layout.set(key, siblings);
      layout.set(grandKey, outer);
      break;
    }
  }
  return { updates: diff(byId, layout) };
}

/** Plan a delete: the node's children take its slot under its own parent, in order. */
export function planDelete(ms: readonly MilestoneNode[], id: string): PositionUpdate[] {
  const { byId, children } = groups(ms);
  const node = byId.get(id);
  if (!node) return [];
  const key = parentKey(node, byId);
  const siblings = [...(children.get(key) ?? [])];
  siblings.splice(siblings.findIndex((m) => m.id === id), 1, ...(children.get(id) ?? []));
  return diff(byId, new Map([[key, siblings]]));
}

/** Progress tallies for an OKR's milestones (nesting doesn't matter). */
export function milestoneCounts(ms: readonly MilestoneNode[]): { done: number; failed: number; total: number } {
  let done = 0;
  let failed = 0;
  for (const m of ms) {
    if (m.status === "done") done++;
    else if (m.status === "failed") failed++;
  }
  return { done, failed, total: ms.length };
}
