import type { PuzzleSpec } from "@/server/types";

/**
 * 由人类求解轨迹验证：全程仅 `unique-candidate` 技巧即可完成。
 * 供 `practice-full-game-singles` 拦截 `/api/practice/puzzle`，避免随机题无法纯裸单链通关。
 */
export const E2E_SINGLES_CHAIN_PUZZLE: PuzzleSpec = {
  seed: "e2e|singles-chain|fixture",
  difficultyScore: 160,
  givens: [
    [3, 0, 0, 0, 0, 0, 7, 5, 0],
    [0, 0, 0, 0, 0, 8, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 8, 2, 6],
    [0, 0, 0, 0, 0, 0, 5, 0, 0],
    [0, 0, 0, 2, 7, 5, 0, 0, 0],
    [8, 0, 0, 0, 9, 6, 0, 0, 3],
    [0, 0, 0, 0, 0, 0, 2, 0, 0],
    [7, 0, 9, 0, 0, 0, 0, 3, 0],
    [0, 1, 2, 6, 0, 7, 0, 9, 0],
  ],
};
