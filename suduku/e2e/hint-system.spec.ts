import { test, expect } from "@playwright/test";
import {
  createGameStateFromGivens,
  serializeGameState,
} from "@/lib/core";
import { getNextHint, solveStepHighlightsToHintFields } from "@/lib/hint";
import { SOLVED_GRID_SAMPLE } from "@/lib/core/fixture";
import type { SolveStep } from "@/lib/solver";

test.describe("Suduku hint system (stub)", () => {
  test("getNextHint skeleton returns null without mutating state", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const before = serializeGameState(state);
    expect(getNextHint(state)).toBeNull();
    expect(serializeGameState(state)).toBe(before);
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
