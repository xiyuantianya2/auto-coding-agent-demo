import { describe, expect, it } from "vitest";

import type { SolveStep } from "@/lib/solver";

import {
  mergeCandidateHighlightsWithEliminations,
  parseEliminationEntries,
} from "./merge-highlight-candidates";

function step(partial: Pick<SolveStep, "highlights" | "eliminations"> & { technique?: string }): SolveStep {
  return {
    technique: partial.technique ?? "test-technique",
    highlights: partial.highlights,
    eliminations: partial.eliminations,
  };
}

describe("parseEliminationEntries", () => {
  it("returns [] for non-array or empty eliminations", () => {
    expect(parseEliminationEntries(undefined)).toEqual([]);
    expect(parseEliminationEntries(null)).toEqual([]);
    expect(parseEliminationEntries("x")).toEqual([]);
    expect(parseEliminationEntries([])).toEqual([]);
  });

  it("skips malformed items and keeps valid triplets", () => {
    expect(
      parseEliminationEntries([
        { r: 0, c: 0, digit: 9 },
        { r: "bad", c: 0, digit: 1 },
        null,
        { r: 1, c: 2, digit: 3 },
        { r: 1, c: 2 },
        { r: 8, c: 8, digit: 10 },
      ]),
    ).toEqual([
      { r: 0, c: 0, digit: 9 },
      { r: 1, c: 2, digit: 3 },
    ]);
  });
});

describe("mergeCandidateHighlightsWithEliminations", () => {
  it("merges candidate digits per cell and omits eliminate when eliminations empty", () => {
    const highlights: SolveStep["highlights"] = [
      { kind: "candidate", ref: { r: 2, c: 3, digit: 4 } },
      { kind: "candidate", ref: { r: 2, c: 3, digit: 7 } },
      { kind: "candidate", ref: { r: 5, c: 5, digit: 1 } },
    ];
    expect(mergeCandidateHighlightsWithEliminations(highlights, undefined)).toEqual([
      { r: 2, c: 3, digits: [4, 7] },
      { r: 5, c: 5, digits: [1] },
    ]);
  });

  it("merges eliminations into eliminate and combines with highlights at same (r,c)", () => {
    const s = step({
      highlights: [
        { kind: "candidate", ref: { r: 0, c: 1, digit: 5 } },
        { kind: "candidate", ref: { r: 0, c: 1, digit: 6 } },
      ],
      eliminations: [
        { r: 0, c: 1, digit: 6 },
        { r: 0, c: 1, digit: 8 },
        { r: 4, c: 4, digit: 2 },
      ],
    });
    expect(mergeCandidateHighlightsWithEliminations(s.highlights, s.eliminations)).toEqual([
      { r: 0, c: 1, digits: [5, 6], eliminate: [6, 8] },
      { r: 4, c: 4, digits: [], eliminate: [2] },
    ]);
  });

  it("dedupes duplicate elimination digits for the same cell", () => {
    expect(
      mergeCandidateHighlightsWithEliminations([], [
        { r: 3, c: 3, digit: 4 },
        { r: 3, c: 3, digit: 4 },
      ]),
    ).toEqual([{ r: 3, c: 3, digits: [], eliminate: [4] }]);
  });

  it("skips invalid elimination rows without failing the merge", () => {
    const s = step({
      highlights: [{ kind: "candidate", ref: { r: 1, c: 1, digit: 2 } }],
      eliminations: [{ r: 1, c: 1, digit: 3 }, { r: 99, c: 0, digit: 1 }, { r: 1, c: 1, digit: 9 }],
    });
    expect(mergeCandidateHighlightsWithEliminations(s.highlights, s.eliminations)).toEqual([
      { r: 1, c: 1, digits: [2], eliminate: [3, 9] },
    ]);
  });
});
