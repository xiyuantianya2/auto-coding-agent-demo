import { describe, expect, it } from "vitest";
import { createGameStateFromGivens } from "@/lib/core";
import type { Grid9 } from "@/lib/core";
import { TECHNIQUE_IDS, TECHNIQUE_RESOLUTION_ORDER, findTechniques } from "@/lib/solver";
import type { SolveStep } from "@/lib/solver";
import { selectNextSolveStep } from "./select-next-solve-step";

const minimalStep = (technique: string): SolveStep => ({
  technique,
  highlights: [{ kind: "cell", ref: { r: 0, c: 0 } }],
});

/** 与 solver 测试相同：易题，引擎输出中含隐单；通常同时存在裸单（裸单优先）。 */
const EASY_PUZZLE_WITH_HIDDEN: Grid9 = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
] as Grid9;

describe("selectNextSolveStep", () => {
  it("returns null for empty input", () => {
    expect(selectNextSolveStep([])).toBeNull();
  });

  it("does not mutate the input array", () => {
    const steps: SolveStep[] = [
      minimalStep(TECHNIQUE_IDS.HIDDEN_SINGLE),
      minimalStep(TECHNIQUE_IDS.NAKED_SINGLE),
    ];
    const copy = steps.map((s) => ({ ...s, highlights: [...s.highlights] }));
    selectNextSolveStep(steps);
    expect(steps).toEqual(copy);
  });

  it("prefers naked single over hidden single when both appear (order in array irrelevant)", () => {
    const hiddenFirst = [
      minimalStep(TECHNIQUE_IDS.HIDDEN_SINGLE),
      minimalStep(TECHNIQUE_IDS.NAKED_SINGLE),
    ];
    expect(selectNextSolveStep(hiddenFirst)?.technique).toBe(TECHNIQUE_IDS.NAKED_SINGLE);

    const nakedFirst = [
      minimalStep(TECHNIQUE_IDS.NAKED_SINGLE),
      minimalStep(TECHNIQUE_IDS.HIDDEN_SINGLE),
    ];
    expect(selectNextSolveStep(nakedFirst)?.technique).toBe(TECHNIQUE_IDS.NAKED_SINGLE);
  });

  it("among same technique, returns the first step in stable order", () => {
    const a = minimalStep(TECHNIQUE_IDS.NAKED_SINGLE);
    const b = { ...minimalStep(TECHNIQUE_IDS.NAKED_SINGLE), highlights: [{ kind: "cell", ref: { r: 1, c: 1 } }] as SolveStep["highlights"] };
    expect(selectNextSolveStep([a, b])).toBe(a);
  });

  it("among multiple elimination tiers, picks earliest in TECHNIQUE_RESOLUTION_ORDER", () => {
    const steps = [
      minimalStep(TECHNIQUE_IDS.X_WING),
      minimalStep(TECHNIQUE_IDS.POINTING),
      minimalStep(TECHNIQUE_IDS.CLAIMING),
    ];
    expect(TECHNIQUE_RESOLUTION_ORDER.indexOf(TECHNIQUE_IDS.POINTING)).toBeLessThan(
      TECHNIQUE_RESOLUTION_ORDER.indexOf(TECHNIQUE_IDS.CLAIMING),
    );
    expect(selectNextSolveStep(steps)?.technique).toBe(TECHNIQUE_IDS.POINTING);
  });

  it("matches findTechniques first step on a real grid (naked before hidden in engine output)", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const steps = findTechniques(state);
    expect(steps.length).toBeGreaterThan(0);
    expect(selectNextSolveStep(steps)).toBe(steps[0]);
  });
});
