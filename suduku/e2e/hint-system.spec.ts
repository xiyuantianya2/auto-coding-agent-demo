import { test, expect } from "@playwright/test";
import {
  createGameStateFromGivens,
  serializeGameState,
} from "@/lib/core";
import {
  getHintMessageKey,
  getNextHint,
  selectNextSolveStep,
  solveStepHighlightsToHintFields,
} from "@/lib/hint";
import {
  ALMOST_SOLVED_ONE_EMPTY,
  SOLVED_GRID_SAMPLE,
} from "@/lib/core/fixture";
import { TECHNIQUE_IDS, type SolveStep } from "@/lib/solver";

test.describe("Suduku hint system", () => {
  test("getNextHint: full board returns null without mutating state", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const before = serializeGameState(state);
    expect(getNextHint(state)).toBeNull();
    expect(serializeGameState(state)).toBe(before);
  });

  test("getNextHint: almost-solved yields naked-single hint aligned with solver", () => {
    const state = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);
    const before = serializeGameState(state);
    const hint = getNextHint(state);
    expect(hint).not.toBeNull();
    expect(hint?.technique).toBe(TECHNIQUE_IDS.NAKED_SINGLE);
    expect(hint?.messageKey).toBe("hint.technique.naked-single");
    expect(serializeGameState(state)).toBe(before);
  });

  test("selectNextSolveStep picks lowest-tier technique per TECHNIQUE_RESOLUTION_ORDER", () => {
    const steps: SolveStep[] = [
      { technique: "hidden-single", highlights: [{ kind: "cell", ref: { r: 0, c: 0 } }] },
      { technique: "naked-single", highlights: [{ kind: "cell", ref: { r: 1, c: 1 } }] },
    ];
    expect(selectNextSolveStep(steps)?.technique).toBe("naked-single");
  });

  test("getHintMessageKey aligns with TECHNIQUE_IDS (smoke)", () => {
    expect(getHintMessageKey(TECHNIQUE_IDS.NAKED_SINGLE)).toBe(
      "hint.technique.naked-single",
    );
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
