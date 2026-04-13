/**
 * 重力下落 + 顶部补位 的展示用位移（行距倍数），与 {@link applyGravityOnly} / 完整补位后的终局盘一致。
 */

import type { Board } from "./board-types";
import { isEmptyCell } from "./board-types";
import { applyGravityOnly } from "./stabilization";

export interface GravityCellOffset {
  /**
   * 与 CSS `translateY(calc(var(--ddp-pitch) * N))` 中的 N 一致；
   * 行号向下增大：自旧格「落到」新格时为 `fromRow - toRow`；自上方进入为负的大偏移。
   */
  readonly translateYRowUnits: number;
}

/**
 * 对 `boardFinal` 上每个非空格给出初始 translateY（相对其终局格），用于 FLIP/transition 首帧。
 */
export function computeGravityRefillOffsets(
  boardAfterClear: Board,
  boardFinal: Board,
): readonly (readonly GravityCellOffset[])[] {
  const rows = boardAfterClear.length;
  const cols = boardAfterClear[0]?.length ?? 0;
  const gOnly = applyGravityOnly(boardAfterClear);

  const offsets: GravityCellOffset[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ translateYRowUnits: 0 })),
  );

  for (let c = 0; c < cols; c += 1) {
    const sources: number[] = [];
    for (let r = rows - 1; r >= 0; r -= 1) {
      if (!isEmptyCell(boardAfterClear[r]![c]!)) sources.push(r);
    }
    const mids: number[] = [];
    for (let r = rows - 1; r >= 0; r -= 1) {
      if (!isEmptyCell(gOnly[r]![c]!)) mids.push(r);
    }
    if (sources.length !== mids.length) {
      throw new Error(
        `computeGravityRefillOffsets: column ${c} source/dest count mismatch (${sources.length} vs ${mids.length})`,
      );
    }
    for (let i = 0; i < sources.length; i += 1) {
      const from = sources[i]!;
      const to = mids[i]!;
      offsets[to]![c] = { translateYRowUnits: from - to };
    }

    for (let r = 0; r < rows; r += 1) {
      if (isEmptyCell(gOnly[r]![c]!) && !isEmptyCell(boardFinal[r]![c]!)) {
        offsets[r]![c] = { translateYRowUnits: -(rows + 2) };
      }
    }
  }

  return offsets;
}
