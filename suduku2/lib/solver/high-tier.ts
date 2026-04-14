import type { GameState } from "@/lib/core";

import { computeCandidates } from "./candidates";
import type { CandidateElimination, CellRef } from "./mid-tier";
import { TechniqueIds } from "./technique-ids";
import type { CandidatesGrid, SolveStep } from "./types";

/**
 * 高阶技巧（本文件）：**X-Wing**（行/列「鱼」的 2×2 特例）。
 *
 * ## 预算参数（超预算则跳过本层扫描，避免极端输入下长时间占用）
 *
 * - **`MAX_ELAPSED_MS_HI`（默认 2000）**：墙上时钟；单次 `findHighTierStepsFromCandidates` 默认最多约 2s。
 * - **`MAX_HI_EMITTED_STEPS`（默认 80）**：去重后最多保留的 `SolveStep` 条数。
 * - **`MAX_HI_PATTERN_PROBES`（默认 4000）**：累计「模式探测」次数（digit × 行对/列对 × 方向），
 *   与多项式扫描同阶；达到上限则**安全退出**（返回已收集结果），不抛错。
 *
 * 主路径为 O(9 × C(9,2) × 常数) 的双重循环，无回溯；上述上限用于防护与测试注入。
 */

/** @internal */
export const MAX_ELAPSED_MS_HI = 2000;

/** @internal */
export const MAX_HI_EMITTED_STEPS = 80;

/** @internal */
export const MAX_HI_PATTERN_PROBES = 4000;

export type HighTierOptions = {
  /**
   * 绝对截止时间（`Date.now()` 可比）。若设置且已过期，立即结束（用于预算冒烟测试）。
   */
  deadlineMs?: number;
  /**
   * 相对超时（毫秒），自调用时刻起算；若同时提供 `deadlineMs`，以 `deadlineMs` 为准。
   */
  maxElapsedMs?: number;
  maxEmittedSteps?: number;
  maxPatternProbes?: number;
};

type InternalBudget = {
  deadline: number;
  emitted: number;
  probes: number;
  maxEmitted: number;
  maxProbes: number;
};

function overBudget(b: InternalBudget): boolean {
  return (
    Date.now() > b.deadline ||
    b.emitted >= b.maxEmitted ||
    b.probes >= b.maxProbes
  );
}

function stepDedupKey(step: SolveStep): string {
  const elim = (step.eliminations ?? []) as CandidateElimination[];
  const es = elim
    .map((e) => `${e.r},${e.c},${e.digit}`)
    .sort()
    .join("|");
  return `${step.technique}#${es}`;
}

function pushStep(
  out: SolveStep[],
  seen: Set<string>,
  step: SolveStep,
  b: InternalBudget,
): void {
  if (overBudget(b)) {
    return;
  }
  const k = stepDedupKey(step);
  if (seen.has(k)) {
    return;
  }
  seen.add(k);
  out.push(step);
  b.emitted++;
}

function getCandidates(
  candidates: CandidatesGrid,
  r: number,
  c: number,
): Set<number> | null {
  return candidates[r][c];
}

function rowDigitColumns(
  candidates: CandidatesGrid,
  r: number,
  d: number,
): number[] {
  const cols: number[] = [];
  for (let c = 0; c < 9; c++) {
    const set = getCandidates(candidates, r, c);
    if (set?.has(d)) {
      cols.push(c);
    }
  }
  return cols;
}

function colDigitRows(
  candidates: CandidatesGrid,
  c: number,
  d: number,
): number[] {
  const rows: number[] = [];
  for (let r = 0; r < 9; r++) {
    const set = getCandidates(candidates, r, c);
    if (set?.has(d)) {
      rows.push(r);
    }
  }
  return rows;
}

function sameTwoColumns(a: number[], b: number[]): boolean {
  if (a.length !== 2 || b.length !== 2) {
    return false;
  }
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa[0] === sb[0] && sa[1] === sb[1];
}

function sameTwoRows(a: number[], b: number[]): boolean {
  return sameTwoColumns(a, b);
}

function resolveBudget(options?: HighTierOptions): InternalBudget {
  const deadline =
    options?.deadlineMs ??
    Date.now() + (options?.maxElapsedMs ?? MAX_ELAPSED_MS_HI);
  return {
    deadline,
    emitted: 0,
    probes: 0,
    maxEmitted: options?.maxEmittedSteps ?? MAX_HI_EMITTED_STEPS,
    maxProbes: options?.maxPatternProbes ?? MAX_HI_PATTERN_PROBES,
  };
}

/**
 * 行方向 X-Wing：两行上某数字 `d` 的候选恰落在相同两列上，则删去这两列上其余行中的 `d`。
 */
function collectXWingRows(
  candidates: CandidatesGrid,
  out: SolveStep[],
  seen: Set<string>,
  b: InternalBudget,
): void {
  for (let d = 1; d <= 9; d++) {
    if (overBudget(b)) {
      return;
    }
    for (let r1 = 0; r1 < 9; r1++) {
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        b.probes++;
        if (overBudget(b)) {
          return;
        }
        const cols1 = rowDigitColumns(candidates, r1, d);
        if (cols1.length !== 2) {
          continue;
        }
        const cols2 = rowDigitColumns(candidates, r2, d);
        if (!sameTwoColumns(cols1, cols2)) {
          continue;
        }
        const cLo = Math.min(cols1[0]!, cols1[1]!);
        const cHi = Math.max(cols1[0]!, cols1[1]!);

        const eliminations: CandidateElimination[] = [];
        for (let r = 0; r < 9; r++) {
          if (r === r1 || r === r2) {
            continue;
          }
          for (const c of [cLo, cHi]) {
            const set = getCandidates(candidates, r, c);
            if (set?.has(d)) {
              eliminations.push({ r, c, digit: d });
            }
          }
        }
        if (eliminations.length === 0) {
          continue;
        }

        const highlights: SolveStep["highlights"] = [
          { kind: "unit", ref: { type: "row", index: r1 } },
          { kind: "unit", ref: { type: "row", index: r2 } },
          { kind: "cell", ref: { r: r1, c: cLo } satisfies CellRef },
          { kind: "cell", ref: { r: r1, c: cHi } satisfies CellRef },
          { kind: "cell", ref: { r: r2, c: cLo } satisfies CellRef },
          { kind: "cell", ref: { r: r2, c: cHi } satisfies CellRef },
          { kind: "candidate", ref: { r: r1, c: cLo, digit: d } },
          { kind: "candidate", ref: { r: r2, c: cHi, digit: d } },
        ];

        pushStep(
          out,
          seen,
          {
            technique: TechniqueIds.XWing,
            highlights,
            eliminations,
            explanationKey: TechniqueIds.XWing,
          },
          b,
        );
      }
    }
  }
}

/**
 * 列方向 X-Wing：两列上某数字 `d` 的候选恰落在相同两行上，则删去这两行上其余列中的 `d`。
 */
function collectXWingCols(
  candidates: CandidatesGrid,
  out: SolveStep[],
  seen: Set<string>,
  b: InternalBudget,
): void {
  for (let d = 1; d <= 9; d++) {
    if (overBudget(b)) {
      return;
    }
    for (let c1 = 0; c1 < 9; c1++) {
      for (let c2 = c1 + 1; c2 < 9; c2++) {
        b.probes++;
        if (overBudget(b)) {
          return;
        }
        const rows1 = colDigitRows(candidates, c1, d);
        if (rows1.length !== 2) {
          continue;
        }
        const rows2 = colDigitRows(candidates, c2, d);
        if (!sameTwoRows(rows1, rows2)) {
          continue;
        }
        const rLo = Math.min(rows1[0]!, rows1[1]!);
        const rHi = Math.max(rows1[0]!, rows1[1]!);

        const eliminations: CandidateElimination[] = [];
        for (let c = 0; c < 9; c++) {
          if (c === c1 || c === c2) {
            continue;
          }
          for (const r of [rLo, rHi]) {
            const set = getCandidates(candidates, r, c);
            if (set?.has(d)) {
              eliminations.push({ r, c, digit: d });
            }
          }
        }
        if (eliminations.length === 0) {
          continue;
        }

        const highlights: SolveStep["highlights"] = [
          { kind: "unit", ref: { type: "col", index: c1 } },
          { kind: "unit", ref: { type: "col", index: c2 } },
          { kind: "cell", ref: { r: rLo, c: c1 } satisfies CellRef },
          { kind: "cell", ref: { r: rLo, c: c2 } satisfies CellRef },
          { kind: "cell", ref: { r: rHi, c: c1 } satisfies CellRef },
          { kind: "cell", ref: { r: rHi, c: c2 } satisfies CellRef },
          { kind: "candidate", ref: { r: rLo, c: c1, digit: d } },
          { kind: "candidate", ref: { r: rHi, c: c2, digit: d } },
        ];

        pushStep(
          out,
          seen,
          {
            technique: TechniqueIds.XWing,
            highlights,
            eliminations,
            explanationKey: TechniqueIds.XWing,
          },
          b,
        );
      }
    }
  }
}

/**
 * 在给定候选网格上扫描高阶技巧（当前：X-Wing），不读 `GameState`。
 */
export function findHighTierStepsFromCandidates(
  candidates: CandidatesGrid,
  options?: HighTierOptions,
): SolveStep[] {
  const out: SolveStep[] = [];
  const seen = new Set<string>();
  const b = resolveBudget(options);

  collectXWingRows(candidates, out, seen, b);
  if (!overBudget(b)) {
    collectXWingCols(candidates, out, seen, b);
  }

  return out;
}

/**
 * 基于当前盘面计算候选后，检测高阶技巧（X-Wing）。
 */
export function findHighTierApplicableSteps(
  state: GameState,
  options?: HighTierOptions,
): SolveStep[] {
  return findHighTierStepsFromCandidates(computeCandidates(state), options);
}
