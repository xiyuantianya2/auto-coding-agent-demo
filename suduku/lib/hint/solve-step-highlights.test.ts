import { describe, expect, it } from "vitest";

import type { SolveStep } from "@/lib/solver";

import { solveStepHighlightsToHintFields } from "./solve-step-highlights";

describe("solveStepHighlightsToHintFields", () => {
  it("仅 cell：并入 cells，行优先排序", () => {
    const step: SolveStep = {
      technique: "test",
      highlights: [
        { kind: "cell", ref: { r: 2, c: 8 } },
        { kind: "cell", ref: { r: 2, c: 0 } },
      ],
    };
    expect(solveStepHighlightsToHintFields(step)).toEqual({
      cells: [
        { r: 2, c: 0 },
        { r: 2, c: 8 },
      ],
    });
  });

  it("仅 unit：行展开为该行全部 9 格（含与「仅空格」相对的约定）", () => {
    const step: SolveStep = {
      technique: "test",
      highlights: [{ kind: "unit", ref: { unit: "row", index: 4 } }],
    };
    const expectedCells = Array.from({ length: 9 }, (_, c) => ({ r: 4, c }));
    expect(solveStepHighlightsToHintFields(step).cells).toEqual(expectedCells);
  });

  it("仅 unit：列与宫展开为 9 格", () => {
    const colStep: SolveStep = {
      technique: "test",
      highlights: [{ kind: "unit", ref: { unit: "col", index: 3 } }],
    };
    expect(solveStepHighlightsToHintFields(colStep).cells).toEqual(
      Array.from({ length: 9 }, (_, r) => ({ r, c: 3 })),
    );

    // 宫 4（中央）：行 3–5，列 3–5
    const boxStep: SolveStep = {
      technique: "test",
      highlights: [{ kind: "unit", ref: { unit: "box", index: 4 } }],
    };
    const boxCells: Array<{ r: number; c: number }> = [];
    for (let i = 3; i < 6; i++) {
      for (let j = 3; j < 6; j++) {
        boxCells.push({ r: i, c: j });
      }
    }
    expect(solveStepHighlightsToHintFields(boxStep).cells).toEqual(boxCells);
  });

  it("仅 candidate：按 (r,c) 聚合 digits，去重升序；cells 不含候选格除非另有 cell/unit", () => {
    const step: SolveStep = {
      technique: "test",
      highlights: [
        { kind: "candidate", ref: { r: 1, c: 1, digit: 9 } },
        { kind: "candidate", ref: { r: 1, c: 1, digit: 3 } },
        { kind: "candidate", ref: { r: 1, c: 1, digit: 3 } },
        { kind: "candidate", ref: { r: 8, c: 0, digit: 5 } },
      ],
    };
    expect(solveStepHighlightsToHintFields(step)).toEqual({
      cells: [],
      highlightCandidates: [
        { r: 1, c: 1, digits: [3, 9] },
        { r: 8, c: 0, digits: [5] },
      ],
    });
  });

  it("混合 cell / unit / candidate：cells 去重合并，候选单独聚合", () => {
    const step: SolveStep = {
      technique: "test",
      highlights: [
        { kind: "cell", ref: { r: 0, c: 0 } },
        { kind: "unit", ref: { unit: "row", index: 0 } },
        { kind: "candidate", ref: { r: 0, c: 1, digit: 7 } },
        { kind: "candidate", ref: { r: 0, c: 1, digit: 2 } },
      ],
    };
    const row0 = Array.from({ length: 9 }, (_, c) => ({ r: 0, c }));
    expect(solveStepHighlightsToHintFields(step)).toEqual({
      cells: row0,
      highlightCandidates: [{ r: 0, c: 1, digits: [2, 7] }],
    });
  });
});
