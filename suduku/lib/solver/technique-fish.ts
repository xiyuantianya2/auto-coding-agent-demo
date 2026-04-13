import {
  BOARD_SIZE,
  DIGIT_MAX,
  DIGIT_MIN,
  EMPTY_CELL,
} from "../core";
import type { Grid9 } from "../core";
import { collectEliminationsForDigit } from "./elimination-helpers";
import { candidateColsForDigitInRow, candidateRowsForDigitInCol } from "./line-candidates";
import { TECHNIQUE_IDS } from "./techniques";
import type { CandidatesGrid, SolveStep } from "./types";

function setsEqualSorted(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isExactlyFishRows(rows: number[], r1: number, r2: number): boolean {
  if (rows.length !== 2) return false;
  const s = new Set(rows);
  return s.size === 2 && s.has(r1) && s.has(r2);
}

function buildFishHighlights(
  digit: number,
  definingRows: number[],
  definingCols: number[],
  grid: Grid9,
  cand: CandidatesGrid,
): SolveStep["highlights"] {
  const highlights: SolveStep["highlights"] = [];
  for (const r of definingRows) {
    highlights.push({ kind: "unit", ref: { unit: "row", index: r } });
  }
  for (const c of definingCols) {
    highlights.push({ kind: "unit", ref: { unit: "col", index: c } });
  }
  const candRefs: SolveStep["highlights"] = [];
  for (const r of definingRows) {
    for (const c of definingCols) {
      if (grid[r][c] === EMPTY_CELL && cand[r][c].has(digit)) {
        candRefs.push({ kind: "candidate", ref: { r, c, digit } });
      }
    }
  }
  candRefs.sort((a, b) => {
    if (a.kind !== "candidate" || b.kind !== "candidate") return 0;
    return a.ref.r - b.ref.r || a.ref.c - b.ref.c;
  });
  return [...highlights, ...candRefs];
}

/**
 * 行向 X-Wing：两行上某数候选恰落在相同两列，且这两列上该数候选恰为这两行。
 * 顺序：数字 1–9；行对 (r1,r2)；列对由候选推出。
 *
 * @param patternCand 用于判定鱼形结构的候选网格（可与全量笔记不同）。
 * @param eliminationCand 用于生成 `eliminations` 的候选来源；默认与 `patternCand` 相同。
 *   若鱼形结构在已部分消除后的笔记上观察，应传入开局全量候选以便列出仍可删的笔记。
 */
export function xWingFromCandidates(
  grid: Grid9,
  patternCand: CandidatesGrid,
  eliminationCand: CandidatesGrid = patternCand,
): SolveStep[] {
  const steps: SolveStep[] = [];

  for (let d = DIGIT_MIN; d <= DIGIT_MAX; d++) {
    for (let r1 = 0; r1 < BOARD_SIZE; r1++) {
      const cols1 = candidateColsForDigitInRow(grid, patternCand, r1, d);
      if (cols1.length !== 2) continue;
      for (let r2 = r1 + 1; r2 < BOARD_SIZE; r2++) {
        const cols2 = candidateColsForDigitInRow(grid, patternCand, r2, d);
        if (!setsEqualSorted(cols1, cols2)) continue;
        const [c1, c2] = cols1;
        const rowsInC1 = candidateRowsForDigitInCol(grid, patternCand, c1, d);
        const rowsInC2 = candidateRowsForDigitInCol(grid, patternCand, c2, d);
        if (!isExactlyFishRows(rowsInC1, r1, r2) || !isExactlyFishRows(rowsInC2, r1, r2)) {
          continue;
        }

        const elimCells: Array<[number, number]> = [];
        for (const c of [c1, c2]) {
          for (let r = 0; r < BOARD_SIZE; r++) {
            if (r === r1 || r === r2) continue;
            elimCells.push([r, c]);
          }
        }
        const eliminations = collectEliminationsForDigit(elimCells, d, grid, eliminationCand);
        if (eliminations.length === 0) continue;

        steps.push({
          technique: TECHNIQUE_IDS.X_WING,
          highlights: buildFishHighlights(d, [r1, r2], [c1, c2], grid, patternCand),
          eliminations,
        });
      }
    }
  }

  return steps;
}

/**
 * 行向剑鱼：三行上某数候选仅落在三列内，且这三列上该数候选仅落在这三行。
 * 顺序：数字 1–9；行三元组 r1<r2<r3。
 *
 * @param eliminationCand 见 {@link xWingFromCandidates}
 */
export function swordfishFromCandidates(
  grid: Grid9,
  patternCand: CandidatesGrid,
  eliminationCand: CandidatesGrid = patternCand,
): SolveStep[] {
  const steps: SolveStep[] = [];

  for (let d = DIGIT_MIN; d <= DIGIT_MAX; d++) {
    for (let r1 = 0; r1 < BOARD_SIZE; r1++) {
      for (let r2 = r1 + 1; r2 < BOARD_SIZE; r2++) {
        for (let r3 = r2 + 1; r3 < BOARD_SIZE; r3++) {
          const rows = [r1, r2, r3];
          let anyEmpty = false;
          for (const r of rows) {
            if (candidateColsForDigitInRow(grid, patternCand, r, d).length === 0) {
              anyEmpty = true;
              break;
            }
          }
          if (anyEmpty) continue;

          const colSet = new Set<number>();
          for (const r of rows) {
            for (const c of candidateColsForDigitInRow(grid, patternCand, r, d)) {
              colSet.add(c);
            }
          }
          if (colSet.size !== 3) continue;

          const definingCols = [...colSet].sort((a, b) => a - b);
          const fishRowSet = new Set(rows);

          let ok = true;
          for (const c of definingCols) {
            const colRows = candidateRowsForDigitInCol(grid, patternCand, c, d);
            for (const rr of colRows) {
              if (!fishRowSet.has(rr)) {
                ok = false;
                break;
              }
            }
            if (!ok) break;
          }
          if (!ok) continue;

          const elimCells: Array<[number, number]> = [];
          for (const c of definingCols) {
            for (let r = 0; r < BOARD_SIZE; r++) {
              if (fishRowSet.has(r)) continue;
              elimCells.push([r, c]);
            }
          }
          const eliminations = collectEliminationsForDigit(elimCells, d, grid, eliminationCand);
          if (eliminations.length === 0) continue;

          steps.push({
            technique: TECHNIQUE_IDS.SWORDFISH,
            highlights: buildFishHighlights(d, rows, definingCols, grid, patternCand),
            eliminations,
          });
        }
      }
    }
  }

  return steps;
}
