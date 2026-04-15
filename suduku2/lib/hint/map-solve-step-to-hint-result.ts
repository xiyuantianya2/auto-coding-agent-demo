import type { SolveStep } from "@/lib/solver";

import { buildChineseHintExplanation } from "./hint-explanation-zh";
import { mapHighlightsToCells } from "./map-highlights";
import {
  mergeCandidateHighlightsWithEliminations,
  parseEliminationEntries,
} from "./merge-highlight-candidates";

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

/**
 * 合并多组格坐标：去重后按行优先 `(r,c)` 稳定排序。
 */
function mergeDedupedCellCoords(
  ...lists: ReadonlyArray<ReadonlyArray<{ r: number; c: number }>>
): Array<{ r: number; c: number }> {
  const seen = new Set<string>();
  for (const list of lists) {
    for (const { r, c } of list) {
      seen.add(cellKey(r, c));
    }
  }
  return [...seen]
    .map((k) => {
      const [rs, cs] = k.split(",");
      return { r: Number(rs), c: Number(cs) };
    })
    .sort((a, b) => a.r - b.r || a.c - b.c);
}

/**
 * 将单条 {@link SolveStep} 映射为提示模块对外契约中的 `HintResult` 形状。
 *
 * - **`technique`**：原样透传。
 * - **`cells`**：来自 `highlights` 的归一格集（见 {@link mapHighlightsToCells}），并与
 *   `highlightCandidates` 组装阶段涉及的全部 `(r,c)` 合并去重。
 *   若某技巧在 solver 侧**仅**给出删减列表、且 `highlights` 未直接标出个别格，
 *   则相关格仍可从 `mergeCandidateHighlightsWithEliminations`（候选高亮 ∪ `eliminations`）推出并进入 `cells`。
 * - **`highlightCandidates`**：由任务 3 的合并函数产出；若无任何条目则省略该字段。
 * - **`explanation`**：中文解题说明（由 `hint-explanation-zh` 内 `buildChineseHintExplanation` 生成）。
 * - **`messageKey`**：对应 `step.explanationKey`（存在时）。
 *
 * 本函数**不**读取或修改盘面，不应用技巧；纯映射、可单测。
 */
export function mapSolveStepToHintResult(step: SolveStep): {
  technique: SolveStep["technique"];
  cells: Array<{ r: number; c: number }>;
  highlightCandidates?: Array<{
    r: number;
    c: number;
    digits: number[];
    eliminate?: number[];
  }>;
  explanation: string;
  messageKey?: string;
} {
  const fromHighlights = mapHighlightsToCells(step.highlights);
  const merged = mergeCandidateHighlightsWithEliminations(step.highlights, step.eliminations);
  const fromMergedCoords = merged.map((m) => ({ r: m.r, c: m.c }));
  const fromEliminationCells = parseEliminationEntries(step.eliminations).map((e) => ({
    r: e.r,
    c: e.c,
  }));

  let cells = mergeDedupedCellCoords(fromHighlights, fromMergedCoords, fromEliminationCells);
  if (cells.length === 0) {
    /** 极端退化：高亮解析失败时仍尝试用删减格坐标保证可定位。 */
    cells = mergeDedupedCellCoords(fromEliminationCells);
  }

  const explanation = buildChineseHintExplanation(step);

  const out: {
    technique: SolveStep["technique"];
    cells: Array<{ r: number; c: number }>;
    highlightCandidates?: Array<{
      r: number;
      c: number;
      digits: number[];
      eliminate?: number[];
    }>;
    explanation: string;
    messageKey?: string;
  } = {
    technique: step.technique,
    cells,
    explanation,
  };

  if (merged.length > 0) {
    out.highlightCandidates = merged;
  }
  if (step.explanationKey !== undefined) {
    out.messageKey = step.explanationKey;
  }

  return out;
}
