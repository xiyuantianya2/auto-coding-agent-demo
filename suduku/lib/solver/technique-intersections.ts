import {
  BOARD_SIZE,
  BOX_SIZE,
  DIGIT_MAX,
  DIGIT_MIN,
  EMPTY_CELL,
  boxIndexFromCell,
} from "../core";
import type { Grid9 } from "../core";
import { TECHNIQUE_IDS } from "./techniques";
import type { CandidateElimination, CandidatesGrid, SolveStep } from "./types";

function boxTopLeft(boxIndex: number): { br: number; bc: number } {
  const row = Math.floor(boxIndex / BOX_SIZE);
  const col = boxIndex % BOX_SIZE;
  return { br: row * BOX_SIZE, bc: col * BOX_SIZE };
}

function iterBoxCells(boxIndex: number): Array<[number, number]> {
  const { br, bc } = boxTopLeft(boxIndex);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < BOX_SIZE; i++) {
    for (let j = 0; j < BOX_SIZE; j++) {
      out.push([br + i, bc + j]);
    }
  }
  return out;
}

function collectEliminations(
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

/**
 * Pointing：宫内某数字候选全部落在同一行或同一列 → 从该行/列在宫外的格删去该数。
 * 顺序：宫 0–8；数字 1–9；先行（row）后列（col）。
 */
export function pointingFromCandidates(grid: Grid9, cand: CandidatesGrid): SolveStep[] {
  const steps: SolveStep[] = [];

  for (let b = 0; b < BOARD_SIZE; b++) {
    for (let d = DIGIT_MIN; d <= DIGIT_MAX; d++) {
      const positions: Array<[number, number]> = [];
      for (const [r, c] of iterBoxCells(b)) {
        if (grid[r][c] !== EMPTY_CELL) continue;
        if (cand[r][c].has(d)) positions.push([r, c]);
      }
      if (positions.length <= 1) continue;

      const rows = new Set(positions.map(([r]) => r));
      const cols = new Set(positions.map(([, c]) => c));

      if (rows.size === 1) {
        const r = [...rows][0]!;
        const elimCells: Array<[number, number]> = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (boxIndexFromCell(r, c) === b) continue;
          elimCells.push([r, c]);
        }
        const eliminations = collectEliminations(elimCells, d, grid, cand);
        if (eliminations.length === 0) continue;
        steps.push({
          technique: TECHNIQUE_IDS.POINTING,
          highlights: [
            { kind: "unit", ref: { unit: "box", index: b } },
            { kind: "unit", ref: { unit: "row", index: r } },
            ...positions.map(([rr, cc]) => ({
              kind: "candidate" as const,
              ref: { r: rr, c: cc, digit: d },
            })),
          ],
          eliminations,
        });
      }

      if (cols.size === 1) {
        const col = [...cols][0]!;
        const elimCells: Array<[number, number]> = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
          if (boxIndexFromCell(r, col) === b) continue;
          elimCells.push([r, col]);
        }
        const eliminations = collectEliminations(elimCells, d, grid, cand);
        if (eliminations.length === 0) continue;
        steps.push({
          technique: TECHNIQUE_IDS.POINTING,
          highlights: [
            { kind: "unit", ref: { unit: "box", index: b } },
            { kind: "unit", ref: { unit: "col", index: col } },
            ...positions.map(([rr, cc]) => ({
              kind: "candidate" as const,
              ref: { r: rr, c: cc, digit: d },
            })),
          ],
          eliminations,
        });
      }
    }
  }

  return steps;
}

/**
 * Claiming（box-line）：某行或列上某数字候选全部落在同一宫内 → 从该宫在同行/列外的格删去该数。
 * 顺序：行 0–8 再列 0–8；数字 1–9。
 */
export function claimingFromCandidates(grid: Grid9, cand: CandidatesGrid): SolveStep[] {
  const steps: SolveStep[] = [];

  const scanLine = (kind: "row" | "col", index: number): void => {
    for (let d = DIGIT_MIN; d <= DIGIT_MAX; d++) {
      const positions: Array<[number, number]> = [];
      for (let k = 0; k < BOARD_SIZE; k++) {
        const r = kind === "row" ? index : k;
        const c = kind === "row" ? k : index;
        if (grid[r][c] !== EMPTY_CELL) continue;
        if (cand[r][c].has(d)) positions.push([r, c]);
      }
      if (positions.length <= 1) continue;
      const boxes = new Set(positions.map(([r, c]) => boxIndexFromCell(r, c)));
      if (boxes.size !== 1) continue;
      const b = [...boxes][0]!;
      const elimCells: Array<[number, number]> = [];
      for (const [r, c] of iterBoxCells(b)) {
        if (kind === "row" && r === index) continue;
        if (kind === "col" && c === index) continue;
        elimCells.push([r, c]);
      }
      const eliminations = collectEliminations(elimCells, d, grid, cand);
      if (eliminations.length === 0) continue;
      steps.push({
        technique: TECHNIQUE_IDS.CLAIMING,
        highlights: [
          { kind: "unit", ref: { unit: kind, index } },
          { kind: "unit", ref: { unit: "box", index: b } },
          ...positions.map(([rr, cc]) => ({
            kind: "candidate" as const,
            ref: { r: rr, c: cc, digit: d },
          })),
        ],
        eliminations,
      });
    }
  };

  for (let r = 0; r < BOARD_SIZE; r++) scanLine("row", r);
  for (let c = 0; c < BOARD_SIZE; c++) scanLine("col", c);

  return steps;
}
