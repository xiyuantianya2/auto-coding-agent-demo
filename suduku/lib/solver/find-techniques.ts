import {
  BOARD_SIZE,
  BOX_SIZE,
  DIGIT_MAX,
  DIGIT_MIN,
  EMPTY_CELL,
  boxIndexFromCell,
  gridFromGameState,
} from "../core";
import type { GameState } from "../core";
import { computeCandidates } from "./compute-candidates";
import { TECHNIQUE_IDS } from "./techniques";
import type { CandidatesGrid, SolveStep } from "./types";

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

function nakedSinglesFromCandidates(
  grid: ReturnType<typeof gridFromGameState>,
  cand: CandidatesGrid,
): SolveStep[] {
  const steps: SolveStep[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (grid[r][c] !== EMPTY_CELL) continue;
      const set = cand[r][c];
      if (set.size !== 1) continue;
      const d = [...set][0]!;
      const box = boxIndexFromCell(r, c);
      steps.push({
        technique: TECHNIQUE_IDS.NAKED_SINGLE,
        highlights: [
          { kind: "cell", ref: { r, c } },
          { kind: "unit", ref: { unit: "row", index: r } },
          { kind: "unit", ref: { unit: "col", index: c } },
          { kind: "unit", ref: { unit: "box", index: box } },
          { kind: "candidate", ref: { r, c, digit: d } },
        ],
      });
    }
  }
  return steps;
}

/**
 * 隐单：在某行 / 列 / 宫内，某数字仅出现在一格的候选中，且该格仍有多个候选（否则已由裸单覆盖）。
 * 同一 (r,c,d) 只记录一次：优先行 → 列 → 宫。
 */
function hiddenSinglesFromCandidates(
  grid: ReturnType<typeof gridFromGameState>,
  cand: CandidatesGrid,
): SolveStep[] {
  const seen = new Set<string>();
  const steps: SolveStep[] = [];

  const tryEmit = (
    unit: "row" | "col" | "box",
    unitIndex: number,
    r: number,
    c: number,
    d: number,
  ): void => {
    if (cand[r][c].size <= 1) return;
    const key = `${r},${c},${d}`;
    if (seen.has(key)) return;
    seen.add(key);
    steps.push({
      technique: TECHNIQUE_IDS.HIDDEN_SINGLE,
      highlights: [
        { kind: "cell", ref: { r, c } },
        { kind: "unit", ref: { unit, index: unitIndex } },
        { kind: "candidate", ref: { r, c, digit: d } },
      ],
    });
  };

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let d = DIGIT_MIN; d <= DIGIT_MAX; d++) {
      let count = 0;
      let pos: [number, number] | null = null;
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (grid[r][c] !== EMPTY_CELL) continue;
        if (cand[r][c].has(d)) {
          count++;
          pos = [r, c];
        }
      }
      if (count === 1 && pos) tryEmit("row", r, pos[0], pos[1], d);
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let d = DIGIT_MIN; d <= DIGIT_MAX; d++) {
      let count = 0;
      let pos: [number, number] | null = null;
      for (let r = 0; r < BOARD_SIZE; r++) {
        if (grid[r][c] !== EMPTY_CELL) continue;
        if (cand[r][c].has(d)) {
          count++;
          pos = [r, c];
        }
      }
      if (count === 1 && pos) tryEmit("col", c, pos[0], pos[1], d);
    }
  }

  for (let b = 0; b < BOARD_SIZE; b++) {
    for (let d = DIGIT_MIN; d <= DIGIT_MAX; d++) {
      let count = 0;
      let pos: [number, number] | null = null;
      for (const [r, c] of iterBoxCells(b)) {
        if (grid[r][c] !== EMPTY_CELL) continue;
        if (cand[r][c].has(d)) {
          count++;
          pos = [r, c];
        }
      }
      if (count === 1 && pos) tryEmit("box", b, pos[0], pos[1], d);
    }
  }

  return steps;
}

/**
 * 基于 {@link computeCandidates} 识别裸单与隐单；顺序稳定：先全部裸单（行优先），再全部隐单（行→列→宫，数字 1–9）。
 */
export function findTechniques(state: GameState): SolveStep[] {
  const cand = computeCandidates(state);
  const grid = gridFromGameState(state);
  return [
    ...nakedSinglesFromCandidates(grid, cand),
    ...hiddenSinglesFromCandidates(grid, cand),
  ];
}
