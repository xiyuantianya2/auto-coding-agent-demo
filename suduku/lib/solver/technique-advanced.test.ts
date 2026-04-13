import { describe, expect, it } from "vitest";
import { EMPTY_CELL } from "../core";
import { createGameStateFromGivens } from "../core";
import type { Grid9 } from "../core";
import { SOLVED_GRID_SAMPLE } from "../core/fixture";
import { createEmptyCandidatesGrid } from "./candidates";
import { computeCandidates } from "./compute-candidates";
import { findTechniques } from "./find-techniques";
import { ELIMINATION_TECHNIQUE_PIPELINE } from "./technique-registry";
import { skyscraperFromCandidates } from "./technique-skyscraper";
import { TECHNIQUE_IDS } from "./techniques";
import { xyWingFromCandidates } from "./technique-xy-wing";

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

/**
 * SudokuWiki Y-Wing Exemplar 1（2025 版题库）：需 Y-Wing 但其余为简单技巧。
 * 覆盖范围：本仓库 XY-Wing 实现为「枢轴 + 双钳制双值格、两钳制互不可见」的标准定义。
 */
const Y_WING_EXEMPLAR_1 =
  "050000080000086000000201070009020601280000054703060900090605000000170000030000010";

/** 手写候选构造最小 Skyscraper（digit=5），用于识别器单元测试；见 Skyscraper describe 内注释。 */
function makeSyntheticSkyscraperGridAndCand(): {
  grid: Grid9;
  cand: ReturnType<typeof createEmptyCandidatesGrid>;
} {
  const grid = SOLVED_GRID_SAMPLE.map((row) => [...row]) as unknown as Grid9;
  grid[0]![0] = EMPTY_CELL;
  grid[0]![1] = EMPTY_CELL;
  grid[2]![0] = EMPTY_CELL;
  grid[2]![2] = EMPTY_CELL;

  const cand = createEmptyCandidatesGrid();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r]![c] !== EMPTY_CELL) {
        cand[r]![c].clear();
      }
    }
  }
  cand[0]![0] = new Set([1, 5]);
  cand[0]![1] = new Set([2, 5]);
  cand[2]![0] = new Set([7, 5]);
  cand[2]![2] = new Set([1, 5]);

  return { grid, cand };
}

describe("XY-Wing", () => {
  it("findTechniques: exemplar puzzle yields at least one xy-wing step", () => {
    const state = createGameStateFromGivens(gridFrom81Line(Y_WING_EXEMPLAR_1));
    const steps = findTechniques(state);
    const xy = steps.filter((s) => s.technique === TECHNIQUE_IDS.XY_WING);
    expect(xy.length).toBeGreaterThanOrEqual(1);
    const step = xy[0]!;
    expect(step.eliminations?.length).toBeGreaterThan(0);
    expect(step.highlights.some((h) => h.kind === "cell")).toBe(true);
  });

  it("xyWingFromCandidates is exported and agrees with registry entry", () => {
    const state = createGameStateFromGivens(gridFrom81Line(Y_WING_EXEMPLAR_1));
    const cand = computeCandidates(state);
    const grid = gridFrom81Line(Y_WING_EXEMPLAR_1);
    const fromFn = xyWingFromCandidates(grid, cand);
    const fromRegistry = ELIMINATION_TECHNIQUE_PIPELINE.find((e) => e.id === TECHNIQUE_IDS.XY_WING);
    expect(fromRegistry).toBeDefined();
    expect(fromRegistry!.detect(grid, cand)).toEqual(fromFn);
  });
});

describe("Skyscraper", () => {
  it("synthetic cand: detects row-based skyscraper and lists eliminations for digit 5", () => {
    const { grid, cand } = makeSyntheticSkyscraperGridAndCand();
    const steps = skyscraperFromCandidates(grid, cand);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    const step = steps.find((s) => s.technique === TECHNIQUE_IDS.SKYSCRAPER);
    expect(step).toBeDefined();
    expect(step!.eliminations?.some((e) => e.digits.includes(5))).toBe(true);
  });

  it("skyscraperFromCandidates matches registry detect function", () => {
    const { grid, cand } = makeSyntheticSkyscraperGridAndCand();
    const fromFn = skyscraperFromCandidates(grid, cand);
    const fromRegistry = ELIMINATION_TECHNIQUE_PIPELINE.find((e) => e.id === TECHNIQUE_IDS.SKYSCRAPER);
    expect(fromRegistry).toBeDefined();
    expect(fromRegistry!.detect(grid, cand)).toEqual(fromFn);
  });
});

describe("ELIMINATION_TECHNIQUE_PIPELINE", () => {
  it("includes skyscraper and xy-wing after fish techniques", () => {
    const ids = ELIMINATION_TECHNIQUE_PIPELINE.map((e) => e.id);
    const iFish = ids.indexOf(TECHNIQUE_IDS.SWORDFISH);
    const iSs = ids.indexOf(TECHNIQUE_IDS.SKYSCRAPER);
    const iXy = ids.indexOf(TECHNIQUE_IDS.XY_WING);
    expect(iFish).toBeGreaterThanOrEqual(0);
    expect(iSs).toBeGreaterThan(iFish);
    expect(iXy).toBeGreaterThan(iSs);
  });
});
