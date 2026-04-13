import { describe, expect, it } from "vitest";
import { createGameStateFromGivens } from "../core";
import type { Grid9 } from "../core";
import { ALMOST_SOLVED_ONE_EMPTY } from "../core/fixture";
import { candidatesGridToSnapshot, computeCandidates } from "./compute-candidates";
import { TECHNIQUE_IDS, TECHNIQUE_RESOLUTION_ORDER } from "./techniques";
import { findTechniques } from "./find-techniques";
import type { CandidateElimination, CandidatesGrid } from "./types";

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

/** HoDoKu 教材「Naked Pair」示例原题（81 字符，`.` 为空）。 */
const HODOKU_NAKED_PAIR_LINE =
  "7....9.3....1.5..64..26...9..2.83951..7........56.............31......6......4.1.";

function gridFrom81Line(line: string): Grid9 {
  if (line.length !== 81) {
    throw new Error(`expected 81 chars, got ${line.length}`);
  }
  const g: number[][] = [];
  for (let r = 0; r < 9; r++) {
    const row: number[] = [];
    for (let c = 0; c < 9; c++) {
      const ch = line[r * 9 + c]!;
      row.push(ch === "." ? 0 : Number(ch));
    }
    g.push(row);
  }
  return g as Grid9;
}

function cloneCandidates(grid: CandidatesGrid): CandidatesGrid {
  return grid.map((row) => row.map((s) => new Set(s)));
}

function applyEliminations(grid: CandidatesGrid, elims: CandidateElimination[]): void {
  for (const e of elims) {
    for (const d of e.digits) {
      grid[e.r][e.c].delete(d);
    }
  }
}

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

describe("findTechniques (pairs & intersections)", () => {
  it("naked pair: eliminations remove digits that were present in candidates", () => {
    const state = createGameStateFromGivens(gridFrom81Line(HODOKU_NAKED_PAIR_LINE));
    const cand = computeCandidates(state);
    const steps = findTechniques(state).filter((s) => s.technique === TECHNIQUE_IDS.NAKED_PAIR);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    const step = steps[0]!;
    expect(step.eliminations?.length).toBeGreaterThan(0);
    const before = candidatesGridToSnapshot(cand);
    for (const e of step.eliminations!) {
      for (const d of e.digits) {
        expect(cand[e.r][e.c].has(d)).toBe(true);
      }
    }
    const next = cloneCandidates(cand);
    applyEliminations(next, step.eliminations!);
    const after = candidatesGridToSnapshot(next);
    expect(after).not.toEqual(before);
    for (const e of step.eliminations!) {
      for (const d of e.digits) {
        expect(next[e.r][e.c].has(d)).toBe(false);
      }
    }
  });

  it("hidden pair: classic easy puzzle yields hidden-pair steps with consistent eliminations", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const cand = computeCandidates(state);
    const steps = findTechniques(state).filter((s) => s.technique === TECHNIQUE_IDS.HIDDEN_PAIR);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    const step = steps[0]!;
    expect(step.eliminations?.length).toBeGreaterThan(0);
    for (const e of step.eliminations!) {
      for (const d of e.digits) {
        expect(cand[e.r][e.c].has(d)).toBe(true);
      }
    }
    const next = cloneCandidates(cand);
    applyEliminations(next, step.eliminations!);
    for (const e of step.eliminations!) {
      for (const d of e.digits) {
        expect(next[e.r][e.c].has(d)).toBe(false);
      }
    }
  });

  it("pointing: eliminations match current candidate sets", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const cand = computeCandidates(state);
    const steps = findTechniques(state).filter((s) => s.technique === TECHNIQUE_IDS.POINTING);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    const step = steps[0]!;
    expect(step.eliminations?.length).toBeGreaterThan(0);
    for (const e of step.eliminations!) {
      for (const d of e.digits) {
        expect(cand[e.r][e.c].has(d)).toBe(true);
      }
    }
  });

  it("claiming: eliminations match current candidate sets", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const cand = computeCandidates(state);
    const steps = findTechniques(state).filter((s) => s.technique === TECHNIQUE_IDS.CLAIMING);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    const step = steps[0]!;
    expect(step.eliminations?.length).toBeGreaterThan(0);
    for (const e of step.eliminations!) {
      for (const d of e.digits) {
        expect(cand[e.r][e.c].has(d)).toBe(true);
      }
    }
  });

  it("TECHNIQUE_RESOLUTION_ORDER lists mid-tier techniques after singles", () => {
    const iPair = TECHNIQUE_RESOLUTION_ORDER.indexOf(TECHNIQUE_IDS.NAKED_PAIR);
    const iPointing = TECHNIQUE_RESOLUTION_ORDER.indexOf(TECHNIQUE_IDS.POINTING);
    expect(iPair).toBeLessThan(iPointing);
  });
});
