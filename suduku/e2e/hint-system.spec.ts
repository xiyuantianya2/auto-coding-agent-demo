import { test, expect } from "@playwright/test";
import {
  createGameStateFromGivens,
  serializeGameState,
} from "@/lib/core";
import { getNextHint, selectNextSolveStep, solveStepHighlightsToHintFields } from "@/lib/hint";
import { SOLVED_GRID_SAMPLE } from "@/lib/core/fixture";
import type { SolveStep } from "@/lib/solver";

test.describe("Suduku hint system (stub)", () => {
  test("getNextHint skeleton returns null without mutating state", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const before = serializeGameState(state);
    expect(getNextHint(state)).toBeNull();
    expect(serializeGameState(state)).toBe(before);
  });

  test("selectNextSolveStep picks lowest-tier technique per TECHNIQUE_RESOLUTION_ORDER", () => {
    const steps: SolveStep[] = [
      { technique: "hidden-single", highlights: [{ kind: "cell", ref: { r: 0, c: 0 } }] },
      { technique: "naked-single", highlights: [{ kind: "cell", ref: { r: 1, c: 1 } }] },
    ];
    expect(selectNextSolveStep(steps)?.technique).toBe("naked-single");
  });

  test("solveStepHighlightsToHintFields maps highlights for UI (smoke)", () => {
    const step: SolveStep = {
      technique: "naked-single",
      highlights: [
        { kind: "cell", ref: { r: 4, c: 4 } },
        { kind: "candidate", ref: { r: 4, c: 4, digit: 3 } },
      ],
    };
    expect(solveStepHighlightsToHintFields(step)).toEqual({
      cells: [{ r: 4, c: 4 }],
      highlightCandidates: [{ r: 4, c: 4, digits: [3] }],
    });
  });
});
