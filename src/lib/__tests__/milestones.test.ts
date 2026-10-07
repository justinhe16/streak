import { describe, expect, it } from "vitest";
import {
  flattenTree,
  isLocked,
  milestoneCounts,
  openDescendants,
  planDelete,
  planMove,
  wouldCycle,
  type MilestoneNode,
  type PositionUpdate,
} from "@/lib/milestones";

function m(id: string, parentId: string | null, position: number, status: MilestoneNode["status"] = "open"): MilestoneNode {
  return { id, parentId, position, status, text: id.toUpperCase() };
}

/** Apply planned updates and return the rendered order as "depth:id". */
function render(ms: MilestoneNode[], updates: PositionUpdate[] = []): string[] {
  const next = ms.map((x) => {
    const u = updates.find((u) => u.id === x.id);
    return u ? { ...x, parentId: u.parentId, position: u.position } : x;
  });
  return flattenTree(next).map((r) => `${r.depth}:${r.milestone.id}`);
}

function ok(result: ReturnType<typeof planMove>): PositionUpdate[] {
  if ("error" in result) throw new Error(result.error);
  return result.updates;
}

// a
// └ b
//   └ c
// d
// e
const tree = [m("a", null, 0, "done"), m("b", "a", 0), m("c", "b", 0), m("d", null, 1), m("e", null, 2)];

describe("flattenTree", () => {
  it("walks depth-first by position", () => {
    expect(render(tree)).toEqual(["0:a", "1:b", "2:c", "0:d", "0:e"]);
  });

  it("reports parent and sibling index", () => {
    const rows = flattenTree(tree);
    expect(rows[1]).toMatchObject({ parent: { id: "a" }, index: 0, siblingCount: 1 });
    expect(rows[3]).toMatchObject({ parent: null, index: 1, siblingCount: 3 });
  });

  it("treats a dangling parent as top level", () => {
    expect(render([m("x", "gone", 0), m("y", null, 1)])).toEqual(["0:x", "0:y"]);
  });

  it("still shows rows caught in a corrupt cycle", () => {
    expect(render([m("p", "q", 0), m("q", "p", 0)]).sort()).toEqual(["0:p", "0:q"]);
  });
});

describe("isLocked", () => {
  const byId = new Map(tree.map((x) => [x.id, x]));
  it("locks a child whose parent isn't done", () => {
    expect(isLocked(byId.get("c")!, byId)).toBe(true);
  });
  it("unlocks once the parent is done", () => {
    expect(isLocked(byId.get("b")!, byId)).toBe(false);
  });
  it("never locks a done or top-level milestone", () => {
    expect(isLocked(byId.get("d")!, byId)).toBe(false);
    expect(isLocked({ ...byId.get("c")!, status: "done" }, byId)).toBe(false);
    expect(isLocked({ ...byId.get("c")!, status: "failed" }, byId)).toBe(false);
  });

  it("keeps children of a failed parent locked", () => {
    const failed = new Map(
      [m("p", null, 0, "failed"), m("k", "p", 0)].map((x) => [x.id, x]),
    );
    expect(isLocked(failed.get("k")!, failed)).toBe(true);
  });
});

describe("openDescendants", () => {
  it("collects every open milestone beneath, skipping done and failed ones", () => {
    const chain = [
      m("r", null, 0),
      m("x", "r", 0),
      m("y", "x", 0, "done"),
      m("z", "y", 0),
      m("w", "r", 1, "failed"),
      m("v", null, 1),
    ];
    expect(openDescendants(chain, "r").sort()).toEqual(["x", "z"]);
    expect(openDescendants(chain, "v")).toEqual([]);
  });
});

describe("milestoneCounts", () => {
  it("tallies done and failed separately", () => {
    expect(milestoneCounts([m("a", null, 0, "done"), m("b", null, 1, "failed"), m("c", null, 2)])).toEqual({
      done: 1,
      failed: 1,
      total: 3,
    });
  });
});

describe("planMove", () => {
  it("moves up and down within siblings only", () => {
    expect(render(tree, ok(planMove(tree, "e", "up")))).toEqual(["0:a", "1:b", "2:c", "0:e", "0:d"]);
    expect(render(tree, ok(planMove(tree, "a", "down")))).toEqual(["0:d", "0:a", "1:b", "2:c", "0:e"]);
    expect(planMove(tree, "b", "up")).toEqual({ error: "Already first." });
    expect(planMove(tree, "e", "down")).toEqual({ error: "Already last." });
  });

  it("indents under the previous sibling, as its last child", () => {
    expect(render(tree, ok(planMove(tree, "d", "indent")))).toEqual(["0:a", "1:b", "2:c", "1:d", "0:e"]);
    expect(planMove(tree, "a", "indent")).toEqual({ error: "Nothing above to nest under." });
  });

  it("outdents to just after its parent", () => {
    expect(render(tree, ok(planMove(tree, "c", "outdent")))).toEqual(["0:a", "1:b", "1:c", "0:d", "0:e"]);
    expect(render(tree, ok(planMove(tree, "b", "outdent")))).toEqual(["0:a", "0:b", "1:c", "0:d", "0:e"]);
    expect(planMove(tree, "a", "outdent")).toEqual({ error: "Already at the top level." });
  });

  it("renumbers touched groups densely and only reports changes", () => {
    const updates = ok(planMove(tree, "d", "indent"));
    expect(updates).toEqual(
      expect.arrayContaining([
        { id: "d", parentId: "a", position: 1 },
        { id: "e", parentId: null, position: 1 },
      ]),
    );
    expect(updates.find((u) => u.id === "a")).toBeUndefined();
  });
});

describe("planDelete", () => {
  it("lifts children into the deleted node's slot", () => {
    const updates = planDelete(tree, "a");
    const rest = tree.filter((x) => x.id !== "a");
    expect(render(rest, updates)).toEqual(["0:b", "1:c", "0:d", "0:e"]);
    expect(updates).toContainEqual({ id: "b", parentId: null, position: 0 });
  });

  it("keeps grandchildren under a deleted middle node's parent", () => {
    const rest = tree.filter((x) => x.id !== "b");
    expect(render(rest, planDelete(tree, "b"))).toEqual(["0:a", "1:c", "0:d", "0:e"]);
  });
});

describe("wouldCycle", () => {
  it("rejects nesting a node under its own descendant", () => {
    expect(wouldCycle(tree, "a", "c")).toBe(true);
    expect(wouldCycle(tree, "a", "a")).toBe(true);
    expect(wouldCycle(tree, "d", "c")).toBe(false);
    expect(wouldCycle(tree, "d", null)).toBe(false);
  });
});
