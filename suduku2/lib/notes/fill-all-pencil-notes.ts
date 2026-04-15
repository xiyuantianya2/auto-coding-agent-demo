import {
  cloneGameState,
  getEffectiveDigitAt,
  isFilledDigit,
  type GameState,
} from "@/lib/core";
import { computeCandidates } from "@/lib/solver";

/**
 * 「一键笔记」：基于**当前**盘面，对每个**非给定且未填写**的空格，将铅笔笔记设为
 * 同行/列/宫约束下仍合法的基础候选（与 {@link computeCandidates} 一致）。
 *
 * - **给定格**与**已有生效填数**的格子：不修改（不写入候选笔记）。
 * - **已有部分笔记**的空格：**整格替换**为当前约束下的完整候选集合（非与旧笔记求并）。
 *
 * 实现仅调用 {@link computeCandidates}（O(81×常数) 扫描），无回溯搜索。
 */
export function applyFullBoardPencilNotes(state: GameState): GameState {
  const candidates = computeCandidates(state);
  const next = cloneGameState(state);

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (isFilledDigit(getEffectiveDigitAt(next, r, c))) {
        continue;
      }

      const cand = candidates[r][c];
      if (cand === null) {
        continue;
      }

      const cell = next.cells[r][c];
      if (cand.size === 0) {
        const cleared: typeof cell = { ...cell };
        delete cleared.notes;
        next.cells[r][c] = cleared;
      } else {
        next.cells[r][c] = { ...cell, notes: new Set(cand) };
      }
      next.grid[r][c] = getEffectiveDigitAt(next, r, c);
    }
  }

  return next;
}
