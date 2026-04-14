import type { CellState, GameState } from "@/lib/core";
import { cloneGameState } from "@/lib/core";
import type { CandidatesGrid } from "@/lib/solver";

/** 与 `lib/core` 文档一致的「已解」判定：有题目给定或玩家已填数字。 */
export function cellIsSolved(cell: CellState): boolean {
  return cell.given !== undefined || cell.value !== undefined;
}

/**
 * 按当前 {@link CandidatesGrid} 收紧笔记：已解格清空笔记；未解格保留与候选的交集。
 * 基于 {@link cloneGameState}，不修改入参 `state`。
 */
export function syncNotesWithCandidates(
  state: GameState,
  candidates: CandidatesGrid,
): GameState {
  const next = cloneGameState(state);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = next.cells[r][c];
      const cand = candidates[r][c];
      if (cellIsSolved(cell)) {
        cell.notes = new Set();
        continue;
      }
      const notes = cell.notes;
      if (notes === undefined || notes.size === 0) {
        continue;
      }
      const intersection = new Set<number>();
      for (const d of notes) {
        if (cand.has(d)) {
          intersection.add(d);
        }
      }
      if (intersection.size === 0) {
        delete cell.notes;
      } else {
        cell.notes = intersection;
      }
    }
  }
  return next;
}
