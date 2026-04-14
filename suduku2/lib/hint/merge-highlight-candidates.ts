import { isFilledDigit, isValidCellCoord } from "@/lib/core";
import type { SolveStep } from "@/lib/solver";

import { extractHighlightCandidateRefs } from "./map-highlights";

/**
 * 与 {@link import("@/lib/hint").HintResult `HintResult.highlightCandidates`} 中单条记录对齐的合并结果。
 */
export type MergedHighlightCandidateEntry = {
  r: number;
  c: number;
  digits: number[];
  eliminate?: number[];
};

type Acc = {
  r: number;
  c: number;
  highlightDigits: Set<number>;
  eliminateDigits: Set<number>;
};

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function getAcc(map: Map<string, Acc>, r: number, c: number): Acc {
  const k = cellKey(r, c);
  let a = map.get(k);
  if (!a) {
    a = { r, c, highlightDigits: new Set(), eliminateDigits: new Set() };
    map.set(k, a);
  }
  return a;
}

/**
 * 解析 `SolveStep.eliminations`：每项应为 `{ r, c, digit }`（与 solver 文档一致）。
 * 非数组、`null`、缺字段或越界坐标/数字的项**跳过**，不抛错。
 */
export function parseEliminationEntries(eliminations: unknown): Array<{ r: number; c: number; digit: number }> {
  if (!Array.isArray(eliminations) || eliminations.length === 0) {
    return [];
  }
  const out: Array<{ r: number; c: number; digit: number }> = [];
  for (const e of eliminations) {
    if (e === null || typeof e !== "object") {
      continue;
    }
    const r = (e as { r?: unknown }).r;
    const c = (e as { c?: unknown }).c;
    const digit = (e as { digit?: unknown }).digit;
    if (typeof r !== "number" || typeof c !== "number" || typeof digit !== "number") {
      continue;
    }
    if (!Number.isInteger(r) || !Number.isInteger(c) || !Number.isInteger(digit)) {
      continue;
    }
    if (!isValidCellCoord(r, c) || !isFilledDigit(digit)) {
      continue;
    }
    out.push({ r, c, digit });
  }
  return out;
}

function sortUniqueDigits(s: Set<number>): number[] {
  return [...s].sort((a, b) => a - b);
}

/**
 * 将 `kind: "candidate"` 高亮与可选 `eliminations` 合并为 `HintResult.highlightCandidates` 形状。
 *
 * - **不读取** `CellState.notes`，仅依据步骤上的高亮与删减列表做推理层提示。
 * - **同一 `(r,c)`**：合并为单条；`digits` 为所有 candidate 高亮数字的并集；`eliminate` 为所有
 *   有效删减项中该格 `digit` 的并集（若存在至少一个删减则输出 `eliminate`，否则省略该字段）。
 * - **稳定顺序**：输出按 `(r,c)` 行优先升序；每条内 `digits` / `eliminate` 均为数字升序。
 *
 * 时间与输入规模线性。
 */
export function mergeCandidateHighlightsWithEliminations(
  highlights: SolveStep["highlights"],
  eliminations: SolveStep["eliminations"],
): MergedHighlightCandidateEntry[] {
  const byCell = new Map<string, Acc>();

  for (const { r, c, digit } of extractHighlightCandidateRefs(highlights)) {
    getAcc(byCell, r, c).highlightDigits.add(digit);
  }

  for (const { r, c, digit } of parseEliminationEntries(eliminations)) {
    getAcc(byCell, r, c).eliminateDigits.add(digit);
  }

  const rows: MergedHighlightCandidateEntry[] = [];
  for (const a of byCell.values()) {
    const digits = sortUniqueDigits(a.highlightDigits);
    const elim = sortUniqueDigits(a.eliminateDigits);
    const entry: MergedHighlightCandidateEntry = {
      r: a.r,
      c: a.c,
      digits,
    };
    if (elim.length > 0) {
      entry.eliminate = elim;
    }
    if (digits.length > 0 || elim.length > 0) {
      rows.push(entry);
    }
  }

  rows.sort((x, y) => x.r - y.r || x.c - y.c);
  return rows;
}
