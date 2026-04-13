import { BOARD_SIZE } from "@/lib/core";
import type { CandidatesGrid } from "./types";

/** 构造与 {@link BOARD_SIZE} 一致的空候选网格（每格空 `Set`）。 */
export function createEmptyCandidatesGrid(): CandidatesGrid {
  const grid: Set<number>[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: Set<number>[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(new Set<number>());
    }
    grid.push(row);
  }
  return grid;
}
