import { BOARD_SIZE, EMPTY_CELL } from "../core";
import type { Grid9 } from "../core";
import type { CandidatesGrid } from "./types";

/**
 * 某行 `r` 上，空格中候选含 `digit` 的列号（升序）。
 * 供鱼形（X-Wing / Swordfish）与行列交叉类技巧复用。
 */
export function candidateColsForDigitInRow(
  grid: Grid9,
  cand: CandidatesGrid,
  r: number,
  digit: number,
): number[] {
  const out: number[] = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    if (grid[r][c] !== EMPTY_CELL) continue;
    if (cand[r][c].has(digit)) out.push(c);
  }
  return out;
}

/**
 * 某列 `c` 上，空格中候选含 `digit` 的行号（升序）。
 */
export function candidateRowsForDigitInCol(
  grid: Grid9,
  cand: CandidatesGrid,
  c: number,
  digit: number,
): number[] {
  const out: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (grid[r][c] !== EMPTY_CELL) continue;
    if (cand[r][c].has(digit)) out.push(r);
  }
  return out;
}
