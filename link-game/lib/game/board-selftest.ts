import {
  generateBoardFromLevel,
  maxDfsNodesForOutputVerification,
  maxDfsNodesForRandomProbe,
} from "./board-generation";
import {
  enumerateConnectablePairs,
  hasAtLeastOneConnectablePair,
} from "./connectivity";
import { isBoardFullySolvable } from "./full-solvability";
import { DEFAULT_LEVELS } from "./levels";
import type { Board, LevelConfig, PatternId } from "./types";

/** 与生成器一致：多数棋盘已在随机阶段用「探测预算」证可解；少数走构造备用时需更大预算（见 `board-generation`）。 */
function assertGeneratedBoardGloballySolvable(
  board: Board,
  level: LevelConfig,
): void {
  if (
    isBoardFullySolvable(board, {
      maxDfsNodes: maxDfsNodesForRandomProbe(level),
    })
  ) {
    return;
  }
  if (
    !isBoardFullySolvable(board, {
      maxDfsNodes: maxDfsNodesForOutputVerification(level),
    })
  ) {
    throw new Error(
      "Generated board is not fully solvable under the same DFS budgets used by the generator.",
    );
  }
}

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

/** Dev 自检：校验成对、可连对存在、（小棋盘）枚举与布尔一致，且全盘可解（与生成器准入一致）。 */
export function runBoardGenerationSelfTest(): void {
  for (const level of DEFAULT_LEVELS) {
    const roundsPerLevel = level.id === 3 ? 5 : 30;

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
      const cells = level.rows * level.cols;
      const useFullPairEnumeration = cells <= 30;

      if (useFullPairEnumeration) {
        const pairs = enumerateConnectablePairs(board);
        if ((pairs.length > 0) !== hasAtLeastOneConnectablePair(board)) {
          throw new Error("enumerateConnectablePairs vs hasAtLeastOneConnectablePair mismatch.");
        }
        if (pairs.length === 0) {
          throw new Error("Generated board has no connectable pair.");
        }
      } else {
        if (!hasAtLeastOneConnectablePair(board)) {
          throw new Error("Generated board has no connectable pair.");
        }
      }

      assertGeneratedBoardGloballySolvable(board, level);
    }
  }
}
