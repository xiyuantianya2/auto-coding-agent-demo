import { describe, expect, it } from "vitest";

import { TECHNIQUE_IDS } from "@/lib/solver";

import type { CurriculumNode } from "./types";
import {
  isChapterUnlocked,
  validateUnlockGraph,
} from "./unlock-graph";

const base = (id: string, unlockAfter?: string[]): CurriculumNode => ({
  id,
  tier: "low",
  techniqueIds: [TECHNIQUE_IDS.NAKED_SINGLE],
  ...(unlockAfter !== undefined ? { unlockAfter } : {}),
});

describe("validateUnlockGraph (task 4)", () => {
  it("accepts a linear DAG (production-shaped)", () => {
    const nodes: CurriculumNode[] = [
      base("a"),
      base("b", ["a"]),
      base("c", ["b"]),
    ];
    expect(validateUnlockGraph(nodes)).toEqual({ ok: true });
  });

  it("rejects missing prerequisite id", () => {
    const nodes: CurriculumNode[] = [
      base("x"),
      base("y", ["not-in-tree"]),
    ];
    const r = validateUnlockGraph(nodes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        kind: "missing_prerequisite",
        chapterId: "y",
        missingId: "not-in-tree",
      });
    }
  });

  it("rejects self-loop", () => {
    const nodes: CurriculumNode[] = [base("solo", ["solo"])];
    const r = validateUnlockGraph(nodes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        kind: "self_loop",
        chapterId: "solo",
      });
    }
  });

  it("rejects a 2-node directed cycle", () => {
    const nodes: CurriculumNode[] = [
      base("u", ["v"]),
      base("v", ["u"]),
    ];
    const r = validateUnlockGraph(nodes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const cycleErr = r.errors.find((e) => e.kind === "cycle");
      expect(cycleErr).toBeDefined();
      if (cycleErr && cycleErr.kind === "cycle") {
        expect(cycleErr.cycle.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("rejects duplicate chapter ids", () => {
    const n = base("dup");
    const nodes: CurriculumNode[] = [n, { ...n }];
    const r = validateUnlockGraph(nodes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some((e) => e.kind === "duplicate_chapter_id"),
      ).toBe(true);
    }
  });
});

describe("isChapterUnlocked (task 4)", () => {
  it("is true when unlockAfter is empty or undefined", () => {
    expect(isChapterUnlocked(base("r"), new Set())).toBe(true);
    expect(isChapterUnlocked(base("r", []), new Set())).toBe(true);
  });

  it("requires every prerequisite in the completed set", () => {
    const node = base("n", ["a", "b"]);
    expect(isChapterUnlocked(node, new Set(["a"]))).toBe(false);
    expect(isChapterUnlocked(node, new Set(["a", "b"]))).toBe(true);
    expect(isChapterUnlocked(node, ["b", "a"])).toBe(true);
  });
});
