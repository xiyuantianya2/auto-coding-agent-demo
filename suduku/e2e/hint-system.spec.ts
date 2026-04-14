import { test, expect } from "@playwright/test";
import {
  createGameStateFromGivens,
  serializeGameState,
} from "@/lib/core";
import { getNextHint } from "@/lib/hint";
import { SOLVED_GRID_SAMPLE } from "@/lib/core/fixture";

test.describe("Suduku hint system (stub)", () => {
  test("getNextHint skeleton returns null without mutating state", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const before = serializeGameState(state);
    expect(getNextHint(state)).toBeNull();
    expect(serializeGameState(state)).toBe(before);
  });
});
