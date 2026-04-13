import {
  BOARD_SIZE,
  DIGIT_MAX,
  DIGIT_MIN,
  EMPTY_CELL,
} from "../core";
import type { Grid9 } from "../core";
import { collectEliminationsForDigit } from "./elimination-helpers";
import { candidateColsForDigitInRow, candidateRowsForDigitInCol } from "./line-candidates";
import { cellsSeeEachOther } from "./peer-utils";
import { TECHNIQUE_IDS } from "./techniques";
import type { CandidatesGrid, SolveStep } from "./types";

function sameUnorderedPair(a: number[], x: number, y: number): boolean {
  if (a.length !== 2) return false;
  const s = new Set([x, y]);
  return s.has(a[0]!) && s.has(a[1]!);
}

function buildSkyscraperHighlights(
  digit: number,
  roof1: [number, number],
  roof2: [number, number],
  sharedLine: { unit: "row" | "col"; index: number },
  grid: Grid9,
  cand: CandidatesGrid,
): SolveStep["highlights"] {
  const out: SolveStep["highlights"] = [
    { kind: "unit", ref: { unit: sharedLine.unit, index: sharedLine.index } },
    { kind: "cell", ref: { r: roof1[0], c: roof1[1] } },
    { kind: "cell", ref: { r: roof2[0], c: roof2[1] } },
  ];
  for (const [r, c] of [roof1, roof2]) {
    if (grid[r][c] === EMPTY_CELL && cand[r][c].has(digit)) {
      out.push({ kind: "candidate", ref: { r, c, digit } });
    }
  }
  return out;
}

function tryRowSkyscraper(
  grid: Grid9,
  cand: CandidatesGrid,
  eliminationCand: CandidatesGrid,
  d: number,
  r1: number,
  r2: number,
): SolveStep | null {
  const S1 = candidateColsForDigitInRow(grid, cand, r1, d);
  const S2 = candidateColsForDigitInRow(grid, cand, r2, d);
  if (S1.length !== 2 || S2.length !== 2) return null;

  const inter = S1.filter((c) => S2.includes(c));
  if (inter.length !== 1) return null;
  const sh = inter[0]!;
  const ca = S1[0] === sh ? S1[1]! : S1[0]!;
  const cb = S2[0] === sh ? S2[1]! : S2[0]!;
  if (ca === cb) return null;

  const rowsInShared = candidateRowsForDigitInCol(grid, cand, sh, d);
  if (rowsInShared.length !== 2 || !sameUnorderedPair(rowsInShared, r1, r2)) {
    return null;
  }

  const roof1: [number, number] = [r1, ca];
  const roof2: [number, number] = [r2, cb];

  const elimCells: Array<[number, number]> = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (grid[r][c] !== EMPTY_CELL) continue;
      if ((r === roof1[0] && c === roof1[1]) || (r === roof2[0] && c === roof2[1])) continue;
      if (cellsSeeEachOther(r, c, roof1[0], roof1[1]) && cellsSeeEachOther(r, c, roof2[0], roof2[1])) {
        elimCells.push([r, c]);
      }
    }
  }

  const eliminations = collectEliminationsForDigit(elimCells, d, grid, eliminationCand);
  if (eliminations.length === 0) return null;

  return {
    technique: TECHNIQUE_IDS.SKYSCRAPER,
    highlights: buildSkyscraperHighlights(d, roof1, roof2, { unit: "col", index: sh }, grid, cand),
    eliminations,
  };
}

function tryColSkyscraper(
  grid: Grid9,
  cand: CandidatesGrid,
  eliminationCand: CandidatesGrid,
  d: number,
  c1: number,
  c2: number,
): SolveStep | null {
  const R1 = candidateRowsForDigitInCol(grid, cand, c1, d);
  const R2 = candidateRowsForDigitInCol(grid, cand, c2, d);
  if (R1.length !== 2 || R2.length !== 2) return null;

  const inter = R1.filter((r) => R2.includes(r));
  if (inter.length !== 1) return null;
  const sh = inter[0]!;
  const ra = R1[0] === sh ? R1[1]! : R1[0]!;
  const rb = R2[0] === sh ? R2[1]! : R2[0]!;
  if (ra === rb) return null;

  const colsInShared = candidateColsForDigitInRow(grid, cand, sh, d);
  if (colsInShared.length !== 2 || !sameUnorderedPair(colsInShared, c1, c2)) {
    return null;
  }

  const roof1: [number, number] = [ra, c1];
  const roof2: [number, number] = [rb, c2];

  const elimCells: Array<[number, number]> = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (grid[r][c] !== EMPTY_CELL) continue;
      if ((r === roof1[0] && c === roof1[1]) || (r === roof2[0] && c === roof2[1])) continue;
      if (cellsSeeEachOther(r, c, roof1[0], roof1[1]) && cellsSeeEachOther(r, c, roof2[0], roof2[1])) {
        elimCells.push([r, c]);
      }
    }
  }

  const eliminations = collectEliminationsForDigit(elimCells, d, grid, eliminationCand);
  if (eliminations.length === 0) return null;

  return {
    technique: TECHNIQUE_IDS.SKYSCRAPER,
    highlights: buildSkyscraperHighlights(d, roof1, roof2, { unit: "row", index: sh }, grid, cand),
    eliminations,
  };
}

/**
 * Skyscraper：两行（或两列）上某数仅各出现在两格，且共享一列（或一行）形成「塔基」；
 * 从同时可见两「楼顶」候选格的空格中删除该数。
 *
 * 本实现覆盖**标准行列双向** Skyscraper；不含 Fin / Sashimi 等变体。
 */
export function skyscraperFromCandidates(
  grid: Grid9,
  cand: CandidatesGrid,
  eliminationCand: CandidatesGrid = cand,
): SolveStep[] {
  const steps: SolveStep[] = [];

  for (let d = DIGIT_MIN; d <= DIGIT_MAX; d++) {
    for (let r1 = 0; r1 < BOARD_SIZE; r1++) {
      for (let r2 = r1 + 1; r2 < BOARD_SIZE; r2++) {
        const step = tryRowSkyscraper(grid, cand, eliminationCand, d, r1, r2);
        if (step) steps.push(step);
      }
    }

    for (let c1 = 0; c1 < BOARD_SIZE; c1++) {
      for (let c2 = c1 + 1; c2 < BOARD_SIZE; c2++) {
        const step = tryColSkyscraper(grid, cand, eliminationCand, d, c1, c2);
        if (step) steps.push(step);
      }
    }
  }

  return steps;
}
