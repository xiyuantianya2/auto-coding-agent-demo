/**
 * 串联 {@link findTechniques}、{@link selectNextSolveStep} 与 {@link solveStepHighlightsToHintFields}，
 * 产出只读高亮提示；不修改盘面、不应用消除。
 */

import { isBoardComplete } from "@/lib/core";
import type { GameState } from "@/lib/core";
import {
  CandidatesComputationError,
  findTechniques,
} from "@/lib/solver";

import { getHintMessageKey } from "./message-keys";
import { selectNextSolveStep } from "./select-next-solve-step";
import { solveStepHighlightsToHintFields } from "./solve-step-highlights";
import type { HintResult } from "./types";

function hasValidHighlights(
  fields: ReturnType<typeof solveStepHighlightsToHintFields>,
): boolean {
  return (
    fields.cells.length > 0 ||
    (fields.highlightCandidates?.length ?? 0) > 0
  );
}

/**
 * 计算「下一步」教学提示；只读分析 {@link GameState}，不填数、不写消除。
 *
 * - 盘面无空格（已满）：`null`
 * - 候选计算失败（模型不变式、明显冲突、空格无合法候选）：`null`
 * - 无可用技巧步骤、或映射后无高亮：`null`
 */
export function getNextHintImpl(state: GameState): HintResult | null {
  if (isBoardComplete(state)) {
    return null;
  }

  let steps;
  try {
    steps = findTechniques(state);
  } catch (e) {
    if (e instanceof CandidatesComputationError) {
      return null;
    }
    throw e;
  }

  const step = selectNextSolveStep(steps);
  if (!step) {
    return null;
  }

  const fields = solveStepHighlightsToHintFields(step);
  if (!hasValidHighlights(fields)) {
    return null;
  }

  const messageKey = getHintMessageKey(step.technique);

  return {
    cells: fields.cells,
    ...(fields.highlightCandidates !== undefined
      ? { highlightCandidates: fields.highlightCandidates }
      : {}),
    technique: step.technique,
    ...(messageKey !== undefined ? { messageKey } : {}),
  };
}
