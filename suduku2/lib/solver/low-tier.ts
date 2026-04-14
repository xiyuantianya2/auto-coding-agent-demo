import type { GameState } from "@/lib/core";

import { computeCandidates } from "./candidates";
import { TechniqueIds } from "./technique-ids";
import type { CandidatesGrid, SolveStep } from "./types";

/**
 * 本文件 `SolveStep` 附加字段约定（与 {@link SolveStep} 类型一致，便于序列化/UI）：
 *
 * - **`highlights[].ref`**
 *   - `kind: "cell"` → `{ r: number; c: number }`（0–8）
 *   - `kind: "unit"` → `{ type: "row" | "col" | "box"; index: number }`（`index` 为 0–8）
 *   - `kind: "candidate"` → `{ r: number; c: number; digit: number }`（标出涉及的候选数字）
 *
 * - **`eliminations`**（可选）：仅「删候选」类技巧填写；每项为
 *   `{ r: number; c: number; digit: number }`，表示在**当前** `CandidatesGrid` 下
 *   应从 `(r,c)` 的候选集合中移除 `digit`（实现只列出仍含该候选的格）。
 *
 * - **裸单 / 唯一候选**（{@link TechniqueIds.UniqueCandidate}）：不填 `eliminations`；
 *   高亮目标格与唯一候选数字，表示可将该格填为该数（不自动改 `GameState`）。
 */

/** @internal */
export type CellRef = { r: number; c: number };

/** @internal */
export type UnitRef = { type: "row" | "col" | "box"; index: number };

/** @internal */
export type CandidateRef = CellRef & { digit: number };

/** @internal */
export type CandidateElimination = CellRef & { digit: number };

function boxIndex(r: number, c: number): number {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

function forEachBoxCell(b: number, fn: (r: number, c: number) => void): void {
  const br = Math.floor(b / 3) * 3;
  const bc = (b % 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      fn(br + dr, bc + dc);
    }
  }
}

function getCandidates(
  candidates: CandidatesGrid,
  r: number,
  c: number,
): Set<number> | null {
  const cell = candidates[r][c];
  return cell;
}

/**
 * 在给定候选网格上扫描低阶技巧（不读 `GameState`）。
 * 供上层缓存候选后复用，或测试注入合成盘面。
 */
export function findLowTierStepsFromCandidates(
  candidates: CandidatesGrid,
): SolveStep[] {
  const steps: SolveStep[] = [];
  collectNakedSingles(candidates, steps);
  collectHiddenSingles(candidates, steps);
  collectPointing(candidates, steps);
  collectBoxLineReductions(candidates, steps);
  return steps;
}

/**
 * 低阶技巧统一入口：在 `computeCandidates` 结果上扫描裸单、隐单、指向与行列摒除，
 * 复杂度 O(81×9×常数)，无回溯搜索。
 */
export function findLowTierApplicableSteps(state: GameState): SolveStep[] {
  return findLowTierStepsFromCandidates(computeCandidates(state));
}

function collectNakedSingles(
  candidates: CandidatesGrid,
  out: SolveStep[],
): void {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const set = getCandidates(candidates, r, c);
      if (!set || set.size !== 1) {
        continue;
      }
      const digit = [...set][0]!;
      const cell: CellRef = { r, c };
      const cref: CandidateRef = { r, c, digit };
      out.push({
        technique: TechniqueIds.UniqueCandidate,
        highlights: [
          { kind: "cell", ref: cell },
          { kind: "candidate", ref: cref },
        ],
        explanationKey: TechniqueIds.UniqueCandidate,
      });
    }
  }
}

function collectHiddenSingles(
  candidates: CandidatesGrid,
  out: SolveStep[],
): void {
  /** 同一 `(cell, digit)` 在行/列/宫扫描中会重复命中，只保留一步。 */
  const seen = new Set<string>();

  function pushHidden(rr: number, cc: number, d: number, unit: UnitRef): void {
      const set = getCandidates(candidates, rr, cc);
      if (!set || set.size === 1) {
        return;
      }
      const key = `${rr}:${cc}:${d}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const cref: CandidateRef = { r: rr, c: cc, digit: d };
      out.push({
        technique: TechniqueIds.HiddenSingle,
        highlights: [
          { kind: "unit", ref: unit },
          { kind: "cell", ref: { r: rr, c: cc } },
          { kind: "candidate", ref: cref },
        ],
        explanationKey: TechniqueIds.HiddenSingle,
      });
  }

  for (let r = 0; r < 9; r++) {
    for (let d = 1; d <= 9; d++) {
      const positions: CellRef[] = [];
      for (let c = 0; c < 9; c++) {
        const set = getCandidates(candidates, r, c);
        if (set?.has(d)) {
          positions.push({ r, c });
        }
      }
      if (positions.length !== 1) {
        continue;
      }
      const { r: rr, c: cc } = positions[0]!;
      pushHidden(rr, cc, d, { type: "row", index: r });
    }
  }

  for (let c = 0; c < 9; c++) {
    for (let d = 1; d <= 9; d++) {
      const positions: CellRef[] = [];
      for (let r = 0; r < 9; r++) {
        const set = getCandidates(candidates, r, c);
        if (set?.has(d)) {
          positions.push({ r, c });
        }
      }
      if (positions.length !== 1) {
        continue;
      }
      const { r: rr, c: cc } = positions[0]!;
      pushHidden(rr, cc, d, { type: "col", index: c });
    }
  }

  for (let b = 0; b < 9; b++) {
    for (let d = 1; d <= 9; d++) {
      const positions: CellRef[] = [];
      forEachBoxCell(b, (r, c) => {
        const set = getCandidates(candidates, r, c);
        if (set?.has(d)) {
          positions.push({ r, c });
        }
      });
      if (positions.length !== 1) {
        continue;
      }
      const { r: rr, c: cc } = positions[0]!;
      pushHidden(rr, cc, d, { type: "box", index: b });
    }
  }
}

function collectPointing(candidates: CandidatesGrid, out: SolveStep[]): void {
  for (let b = 0; b < 9; b++) {
    for (let d = 1; d <= 9; d++) {
      const inBox: CellRef[] = [];
      forEachBoxCell(b, (r, c) => {
        const set = getCandidates(candidates, r, c);
        if (set?.has(d)) {
          inBox.push({ r, c });
        }
      });
      if (inBox.length < 2) {
        continue;
      }
      const rows = new Set(inBox.map((p) => p.r));
      const cols = new Set(inBox.map((p) => p.c));

      if (rows.size === 1) {
        const R = [...rows][0]!;
        const eliminations: CandidateElimination[] = [];
        for (let c = 0; c < 9; c++) {
          if (boxIndex(R, c) === b) {
            continue;
          }
          const set = getCandidates(candidates, R, c);
          if (set?.has(d)) {
            eliminations.push({ r: R, c, digit: d });
          }
        }
        if (eliminations.length === 0) {
          continue;
        }
        const unitBox: UnitRef = { type: "box", index: b };
        const unitRow: UnitRef = { type: "row", index: R };
        const sample = inBox[0]!;
        out.push({
          technique: TechniqueIds.Pointing,
          highlights: [
            { kind: "unit", ref: unitBox },
            { kind: "unit", ref: unitRow },
            {
              kind: "candidate",
              ref: { r: sample.r, c: sample.c, digit: d },
            },
          ],
          eliminations,
          explanationKey: TechniqueIds.Pointing,
        });
      }

      if (cols.size === 1) {
        const C = [...cols][0]!;
        const eliminations: CandidateElimination[] = [];
        for (let r = 0; r < 9; r++) {
          if (boxIndex(r, C) === b) {
            continue;
          }
          const set = getCandidates(candidates, r, C);
          if (set?.has(d)) {
            eliminations.push({ r, c: C, digit: d });
          }
        }
        if (eliminations.length === 0) {
          continue;
        }
        const unitBox: UnitRef = { type: "box", index: b };
        const unitCol: UnitRef = { type: "col", index: C };
        const sample = inBox[0]!;
        out.push({
          technique: TechniqueIds.Pointing,
          highlights: [
            { kind: "unit", ref: unitBox },
            { kind: "unit", ref: unitCol },
            {
              kind: "candidate",
              ref: { r: sample.r, c: sample.c, digit: d },
            },
          ],
          eliminations,
          explanationKey: TechniqueIds.Pointing,
        });
      }
    }
  }
}

function collectBoxLineReductions(
  candidates: CandidatesGrid,
  out: SolveStep[],
): void {
  for (let r = 0; r < 9; r++) {
    for (let d = 1; d <= 9; d++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) {
        const set = getCandidates(candidates, r, c);
        if (set?.has(d)) {
          cols.push(c);
        }
      }
      if (cols.length < 2) {
        continue;
      }
      const boxes = new Set(cols.map((c) => boxIndex(r, c)));
      if (boxes.size !== 1) {
        continue;
      }
      const b = [...boxes][0]!;
      const eliminations: CandidateElimination[] = [];
      forEachBoxCell(b, (rr, cc) => {
        if (rr === r) {
          return;
        }
        const set = getCandidates(candidates, rr, cc);
        if (set?.has(d)) {
          eliminations.push({ r: rr, c: cc, digit: d });
        }
      });
      if (eliminations.length === 0) {
        continue;
      }
      const unitRow: UnitRef = { type: "row", index: r };
      const unitBox: UnitRef = { type: "box", index: b };
      const c0 = cols[0]!;
      out.push({
        technique: TechniqueIds.BoxLineReduction,
        highlights: [
          { kind: "unit", ref: unitRow },
          { kind: "unit", ref: unitBox },
          { kind: "candidate", ref: { r, c: c0, digit: d } },
        ],
        eliminations,
        explanationKey: TechniqueIds.BoxLineReduction,
      });
    }
  }

  for (let c = 0; c < 9; c++) {
    for (let d = 1; d <= 9; d++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) {
        const set = getCandidates(candidates, r, c);
        if (set?.has(d)) {
          rows.push(r);
        }
      }
      if (rows.length < 2) {
        continue;
      }
      const boxes = new Set(rows.map((r) => boxIndex(r, c)));
      if (boxes.size !== 1) {
        continue;
      }
      const b = [...boxes][0]!;
      const eliminations: CandidateElimination[] = [];
      forEachBoxCell(b, (rr, cc) => {
        if (cc === c) {
          return;
        }
        const set = getCandidates(candidates, rr, cc);
        if (set?.has(d)) {
          eliminations.push({ r: rr, c: cc, digit: d });
        }
      });
      if (eliminations.length === 0) {
        continue;
      }
      const unitCol: UnitRef = { type: "col", index: c };
      const unitBox: UnitRef = { type: "box", index: b };
      const r0 = rows[0]!;
      out.push({
        technique: TechniqueIds.BoxLineReduction,
        highlights: [
          { kind: "unit", ref: unitCol },
          { kind: "unit", ref: unitBox },
          { kind: "candidate", ref: { r: r0, c, digit: d } },
        ],
        eliminations,
        explanationKey: TechniqueIds.BoxLineReduction,
      });
    }
  }
}
