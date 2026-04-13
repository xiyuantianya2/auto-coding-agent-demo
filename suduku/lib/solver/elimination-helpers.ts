import { EMPTY_CELL } from "../core";
import type { Grid9 } from "../core";
import type { CandidateElimination, CandidatesGrid } from "./types";

/**
 * 从若干坐标收集「当前候选仍含 digit」的消除项，按格合并数字并稳定排序。
 * 与鱼形技法共用，供 Skyscraper / XY-Wing 等复用。
 */
export function collectEliminationsForDigit(
  cells: Array<[number, number]>,
  d: number,
  grid: Grid9,
  cand: CandidatesGrid,
): CandidateElimination[] {
  const perCell = new Map<string, Set<number>>();
  for (const [r, c] of cells) {
    if (grid[r][c] !== EMPTY_CELL) continue;
    if (!cand[r][c].has(d)) continue;
    const key = `${r},${c}`;
    let s = perCell.get(key);
    if (!s) {
      s = new Set<number>();
      perCell.set(key, s);
    }
    s.add(d);
  }
  const eliminations: CandidateElimination[] = [];
  for (const [key, digits] of perCell) {
    const [r, c] = key.split(",").map(Number) as [number, number];
    eliminations.push({ r, c, digits: [...digits].sort((a, b) => a - b) });
  }
  eliminations.sort((a, b) => a.r - b.r || a.c - b.c);
  return eliminations;
}
