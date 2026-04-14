import { EMPTY_CELL, isFilledDigit } from "./constants";
import { getEffectiveCellDigit } from "./placement";
import type { CellState } from "./types";

/**
 * 规则层单元格不变式（与 {@link CellState} 文档一致）：
 *
 * - `given` / `value`（若存在）须为 `1`–`9`。
 * - `notes` 中每个元素须为 `1`–`9`。
 * - **互斥**：若当前存在生效确定数字（`given` 优先于 `value`），则不得保留铅笔笔记。
 *
 * 不校验 `grid` 与 `cells` 的全盘同步；见 {@link GameState} 约定。
 */
export function isCellStateRuleConsistent(cell: CellState): boolean {
  if (cell.given !== undefined && !isFilledDigit(cell.given)) {
    return false;
  }
  if (cell.value !== undefined && !isFilledDigit(cell.value)) {
    return false;
  }
  const notes = cell.notes;
  if (notes) {
    for (const d of notes) {
      if (!isFilledDigit(d)) {
        return false;
      }
    }
  }
  const effective = getEffectiveCellDigit(cell);
  if (effective !== EMPTY_CELL && notes !== undefined && notes.size > 0) {
    return false;
  }
  return true;
}
