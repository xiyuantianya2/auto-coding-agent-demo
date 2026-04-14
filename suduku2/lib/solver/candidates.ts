import {
  EMPTY_CELL,
  getEffectiveDigitAt,
  isFilledDigit,
  isValidPlacement,
  MAX_DIGIT,
  MIN_DIGIT,
  type GameState,
} from "@/lib/core";

import type { CandidatesGrid } from "./types";

/**
 * 基于当前盘面已出现的确定数字（`given`/`value` 生效值），按标准数独同行/列/宫约束，
 * 计算每格可填候选；**不**应用任何高阶推理技巧，也**不**读取 `cells[*][*].notes`。
 *
 * 时间复杂度 O(81×9×27)，典型调用在毫秒级以下。
 */
export function computeCandidates(state: GameState): CandidatesGrid {
  const out: CandidatesGrid = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CandidatesGrid[0][0] => null),
  );

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const d = getEffectiveDigitAt(state, r, c);
      if (d !== EMPTY_CELL && isFilledDigit(d)) {
        out[r][c] = null;
        continue;
      }

      const candidates = new Set<number>();
      for (let n = MIN_DIGIT; n <= MAX_DIGIT; n++) {
        if (isValidPlacement(state, r, c, n)) {
          candidates.add(n);
        }
      }
      out[r][c] = candidates;
    }
  }

  return out;
}
