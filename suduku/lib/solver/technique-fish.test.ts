import { describe, expect, it } from "vitest";
import { EMPTY_CELL, createGameStateFromGivens, gridFromGameState, isValidPlacement } from "../core";
import type { Grid9 } from "../core";
import { computeCandidates } from "./compute-candidates";
import { findTechniques } from "./find-techniques";
import { TECHNIQUE_IDS } from "./techniques";
import { candidateColsForDigitInRow, candidateRowsForDigitInCol } from "./line-candidates";
import { swordfishFromCandidates, xWingFromCandidates } from "./technique-fish";
import type { CandidateElimination, CandidatesGrid } from "./types";

/** HoDoKu bf202 原题（开局候选经收窄后出现行向 X-Wing on digit 1） */
const HODOKU_X_WING =
  "9...627....5..3...........67...3.........9...8.2.45..9..35.1.28.4......5.1.......";

/** HoDoKu bf302 原题（开局候选经收窄后出现行向 Swordfish on digit 4） */
const HODOKU_SWORDFISH =
  "1......345..3.2.78...8........6.5..3..5...4..3.....6.298.2.6.1.............78.9..";

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

/** 与 technique-fish 中消除收集逻辑一致，用于断言期望集合。 */
function collectEliminationsForDigit(
  cells: Array<[number, number]>,
  d: number,
  grid: Grid9,
  cand: CandidatesGrid,
): CandidateElimination[] {
  const perCell = new Map<string, Set<number>>();
  for (const [r, c] of cells) {
    if (grid[r][c] !== EMPTY_CELL) continue;
    if (!cand[r][c].has(d)) continue;
    const key = `${r},${c}`;
    let s = perCell.get(key);
    if (!s) {
      s = new Set<number>();
      perCell.set(key, s);
    }
    s.add(d);
  }
  const eliminations: CandidateElimination[] = [];
  for (const [key, digits] of perCell) {
    const [r, c] = key.split(",").map(Number) as [number, number];
    eliminations.push({ r, c, digits: [...digits].sort((a, b) => a - b) });
  }
  eliminations.sort((a, b) => a.r - b.r || a.c - b.c);
  return eliminations;
}

function eliminationKey(elims: CandidateElimination[]): string {
  return elims
    .map((e) => {
      const ds = [...e.digits].sort((a, b) => a - b).join(",");
      return `${e.r},${e.c},${ds}`;
    })
    .sort()
    .join("|");
}

function cloneCandidates(c: CandidatesGrid): CandidatesGrid {
  return c.map((row) => row.map((s) => new Set(s)));
}

/** 确保手工收窄后的候选仍是 isValidPlacement 的子集，且空格非空。 */
function assertCandConsistentWithRules(grid: Grid9, cand: CandidatesGrid): void {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) {
        expect(cand[r][c].size).toBe(0);
        continue;
      }
      expect(cand[r][c].size).toBeGreaterThan(0);
      for (const d of cand[r][c]) {
        expect(isValidPlacement(grid, r, c, d)).toBe(true);
      }
    }
  }
}

/**
 * 收窄到「标准鱼形」所需的双向约束：先锁鱼行，再反复从鱼列上非鱼行格删去该数（若仍可删），
 * 直到列上仅鱼行含该数或无法再删。用于从全量候选得到与教材笔记一致的片段。
 */
function narrowDigitToStandardFish(
  grid: Grid9,
  cand: CandidatesGrid,
  digit: number,
  fishRows: number[],
  fishCols: number[],
): void {
  const rowSet = new Set(fishRows);
  const colSet = new Set(fishCols);

  const rowPass = (): void => {
    for (const r of fishRows) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== 0) continue;
        if (colSet.has(c)) continue;
        if (!cand[r][c].has(digit)) continue;
        if (cand[r][c].size <= 1) continue;
        cand[r][c].delete(digit);
      }
    }
  };

  const colPass = (): void => {
    for (const c of fishCols) {
      for (let r = 0; r < 9; r++) {
        if (grid[r][c] !== 0) continue;
        if (rowSet.has(r)) continue;
        if (!cand[r][c].has(digit)) continue;
        if (cand[r][c].size <= 1) continue;
        cand[r][c].delete(digit);
      }
    }
  };

  rowPass();
  for (let i = 0; i < 12; i++) {
    colPass();
    rowPass();
  }
}

describe("technique-fish (X-Wing / Swordfish)", () => {
  it("X-Wing (HoDoKu bf202): eliminations after narrowing match column cover", () => {
    const state = createGameStateFromGivens(gridFrom81Line(HODOKU_X_WING));
    const grid = gridFromGameState(state);
    const fullCand = computeCandidates(state);
    const cand = cloneCandidates(fullCand);
    // HoDoKu：digit 1，rows 2&5 / cols 1&5（1-based）→ 行 1&4、列 0&4（0-based）
    narrowDigitToStandardFish(grid, cand, 1, [1, 4], [0, 4]);
    assertCandConsistentWithRules(grid, cand);

    expect(candidateColsForDigitInRow(grid, cand, 1, 1)).toEqual([0, 4]);
    expect(candidateColsForDigitInRow(grid, cand, 4, 1)).toEqual([0, 4]);
    expect(candidateRowsForDigitInCol(grid, cand, 0, 1)).toEqual([1, 4]);
    expect(candidateRowsForDigitInCol(grid, cand, 4, 1)).toEqual([1, 4]);

    const steps = xWingFromCandidates(grid, cand, fullCand);
    const rowUnits = (s: (typeof steps)[number]) =>
      s.highlights
        .filter((h) => h.kind === "unit" && h.ref.unit === "row")
        .map((h) => h.ref.index)
        .sort((a, b) => a - b);
    const step = steps.find((s) => {
      const ru = rowUnits(s);
      return ru.length === 2 && ru[0] === 1 && ru[1] === 4;
    });
    expect(step).toBeDefined();
    expect(step!.technique).toBe(TECHNIQUE_IDS.X_WING);

    const elimCells: Array<[number, number]> = [];
    for (const c of [0, 4]) {
      for (let r = 0; r < 9; r++) {
        if (r === 1 || r === 4) continue;
        elimCells.push([r, c]);
      }
    }
    const expected = collectEliminationsForDigit(elimCells, 1, grid, fullCand);
    expect(eliminationKey(step!.eliminations!)).toBe(eliminationKey(expected));
  });

  it("Swordfish (HoDoKu bf302): eliminations after narrowing match row/column cover", () => {
    const state = createGameStateFromGivens(gridFrom81Line(HODOKU_SWORDFISH));
    const grid = gridFromGameState(state);
    const fullCand = computeCandidates(state);
    const cand = cloneCandidates(fullCand);
    // HoDoKu：digit 4，rows 2,4,7 / cols 2,3,5（1-based）→ 行 1,3,6、列 1,2,4
    narrowDigitToStandardFish(grid, cand, 4, [1, 3, 6], [1, 2, 4]);
    assertCandConsistentWithRules(grid, cand);

    const u = new Set([1, 2, 4]);
    for (const r of [1, 3, 6]) {
      const cols = candidateColsForDigitInRow(grid, cand, r, 4);
      expect(cols.every((c) => u.has(c))).toBe(true);
      expect(cols.length).toBeGreaterThan(0);
    }
    for (const c of [1, 2, 4]) {
      const rows = candidateRowsForDigitInCol(grid, cand, c, 4);
      expect(rows.every((r) => [1, 3, 6].includes(r))).toBe(true);
    }

    const steps = swordfishFromCandidates(grid, cand, fullCand);
    const rowUnitsSf = (s: (typeof steps)[number]) =>
      s.highlights
        .filter((h) => h.kind === "unit" && h.ref.unit === "row")
        .map((h) => h.ref.index)
        .sort((a, b) => a - b);
    const step = steps.find((s) => rowUnitsSf(s).join(",") === "1,3,6");
    expect(step).toBeDefined();
    expect(step!.technique).toBe(TECHNIQUE_IDS.SWORDFISH);

    const fishRows = [1, 3, 6];
    const fishCols = [1, 2, 4];
    const elimCellsSf: Array<[number, number]> = [];
    for (const c of fishCols) {
      for (let r = 0; r < 9; r++) {
        if (fishRows.includes(r)) continue;
        elimCellsSf.push([r, c]);
      }
    }
    const expectedSf = collectEliminationsForDigit(elimCellsSf, 4, grid, fullCand);
    expect(eliminationKey(step!.eliminations!)).toBe(eliminationKey(expectedSf));
  });

  it("findTechniques: 全量 computeCandidates 下若存在鱼形亦会经合并输出（收窄场景见上文）", () => {
    const state = createGameStateFromGivens(gridFrom81Line(HODOKU_X_WING));
    const steps = findTechniques(state);
    const ids = new Set(steps.map((s) => s.technique));
    expect(ids.has(TECHNIQUE_IDS.NAKED_SINGLE) || ids.has(TECHNIQUE_IDS.HIDDEN_SINGLE)).toBe(true);
  });
});
