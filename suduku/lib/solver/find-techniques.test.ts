import { describe, expect, it } from "vitest";
import { createGameStateFromGivens } from "../core";
import type { Grid9 } from "../core";
import { ALMOST_SOLVED_ONE_EMPTY } from "../core/fixture";
import { TECHNIQUE_IDS } from "./techniques";
import { findTechniques } from "./find-techniques";

/** 经典易题（常见于教程）：开局含隐单（某数字在某行/列/宫仅一处候选）。 */
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

describe("findTechniques (naked & hidden singles)", () => {
  it("naked single: almost-solved grid has one placement at (8,8) digit 8", () => {
    const state = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);
    const steps = findTechniques(state);
    const naked = steps.filter((s) => s.technique === TECHNIQUE_IDS.NAKED_SINGLE);
    expect(naked.length).toBeGreaterThanOrEqual(1);
    const first = naked[0]!;
    expect(first.highlights.length).toBeGreaterThan(0);
    expect(first).toMatchObject({
      technique: TECHNIQUE_IDS.NAKED_SINGLE,
      highlights: expect.arrayContaining([
        { kind: "cell", ref: { r: 8, c: 8 } },
        { kind: "candidate", ref: { r: 8, c: 8, digit: 8 } },
      ]),
    });
  });

  it("hidden single: classic easy puzzle yields at least one hidden-single step", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const steps = findTechniques(state);
    const hidden = steps.filter((s) => s.technique === TECHNIQUE_IDS.HIDDEN_SINGLE);
    expect(hidden.length).toBeGreaterThanOrEqual(1);
    const h = hidden[0]!;
    expect(h.highlights.length).toBeGreaterThan(0);
    expect(h.highlights.some((x) => x.kind === "cell")).toBe(true);
    expect(h.highlights.some((x) => x.kind === "unit")).toBe(true);
  });

  it("stable order: same state yields identical steps", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const a = findTechniques(state);
    const b = findTechniques(state);
    expect(a).toEqual(b);
  });
});
