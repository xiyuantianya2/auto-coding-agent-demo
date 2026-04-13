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
import { ELIMINATION_TECHNIQUE_PIPELINE } from "./technique-registry";
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

function eliminationKey(eliminations: CandidateElimination[]): string {
  return eliminations
    .map((e) => {
      const ds = [...e.digits].sort((a, b) => a - b).join(",");
      return `${e.r},${e.c},${ds}`;
    })
    .sort()
    .join("|");
}

/**
 * 合并带 eliminations 的步骤：按 {@link ELIMINATION_TECHNIQUE_PIPELINE} 顺序，
 * **同一组消除**（{@link eliminationKey} 相同）只保留最先出现的一条，避免多单位重复或与低优先级技法冲突。
 * 裸单 / 隐单无 eliminations，不参与去重。
 */
function mergeEliminationSteps(batches: SolveStep[][]): SolveStep[] {
  const seen = new Set<string>();
  const out: SolveStep[] = [];
  for (const batch of batches) {
    for (const step of batch) {
      if (!step.eliminations?.length) continue;
      const k = eliminationKey(step.eliminations);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(step);
    }
  }
  return out;
}

/**
 * 基于 {@link computeCandidates} 识别技巧；顺序稳定：
 * 1. 全部裸单（行优先）
 * 2. 全部隐单（行 → 列 → 宫，数字 1–9）
 * 3. 中阶与高阶带消除步骤：见 {@link ELIMINATION_TECHNIQUE_PIPELINE}（组内顺序见各实现），并对消除集合去重
 */
export function findTechniques(state: GameState): SolveStep[] {
  const cand = computeCandidates(state);
  const grid = gridFromGameState(state);
  const mid = mergeEliminationSteps(
    ELIMINATION_TECHNIQUE_PIPELINE.map((entry) => entry.detect(grid, cand)),
  );
  return [
    ...nakedSinglesFromCandidates(grid, cand),
    ...hiddenSinglesFromCandidates(grid, cand),
    ...mid,
  ];
}
