import { generateBoardFromLevel } from "./board-generation";
import { hasAtLeastOneConnectablePair } from "./connectivity";
import { DEFAULT_LEVELS } from "./levels";
import type { Board, PatternId } from "./types";

function countPatterns(board: Board): Map<PatternId, number> {
  const m = new Map<PatternId, number>();
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const v = board.cells[r][c];
      if (v === null) continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
  }
  return m;
}

/** Dev 自检：校验成对、可连对存在、尺寸正确。 */
export function runBoardGenerationSelfTest(): void {
  const roundsPerLevel = 30;

  for (const level of DEFAULT_LEVELS) {
    for (let i = 0; i < roundsPerLevel; i++) {
      const board = generateBoardFromLevel(level);
      if (board.rows !== level.rows || board.cols !== level.cols) {
        throw new Error("Board dimensions mismatch.");
      }
      const counts = countPatterns(board);
      if (counts.size !== level.tileKindCount) {
        throw new Error("Pattern variety mismatch.");
      }
      for (const n of counts.values()) {
        if (n !== 2) {
          throw new Error("Each pattern must appear exactly twice.");
        }
      }
      if (!hasAtLeastOneConnectablePair(board)) {
        throw new Error("Generated board has no connectable pair.");
      }
    }
  }
}
