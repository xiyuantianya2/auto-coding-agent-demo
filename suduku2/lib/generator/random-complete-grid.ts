import type { Grid9 } from "@/lib/core";

/**
 * 标准数独文献中常用的一个**完整有效解**种子盘（9×9）。
 * 通过 {@link generateRandomCompleteGrid} 中的行列/宫/数字置换与可选转置随机化。
 */
const SEED_SOLUTION: Grid9 = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function cloneGrid9(grid: Grid9): Grid9 {
  return grid.map((row) => row.slice());
}

function shuffleIndices3(rng: () => number): [number, number, number] {
  const a: [number, number, number] = [0, 1, 2];
  for (let i = 2; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j]!;
    a[j] = t!;
  }
  return a;
}

function permuteRows(grid: Grid9, rng: () => number): Grid9 {
  const bandOrder = shuffleIndices3(rng);
  const rowOrder: number[] = [];
  for (const b of bandOrder) {
    const base = b * 3;
    const within = shuffleIndices3(rng);
    for (const w of within) {
      rowOrder.push(base + w);
    }
  }
  return rowOrder.map((r) => grid[r]!.slice());
}

function permuteCols(grid: Grid9, rng: () => number): Grid9 {
  const stackOrder = shuffleIndices3(rng);
  const colOrder: number[] = [];
  for (const s of stackOrder) {
    const base = s * 3;
    const within = shuffleIndices3(rng);
    for (const w of within) {
      colOrder.push(base + w);
    }
  }
  const next = cloneGrid9(grid);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      next[r]![c] = grid[r]![colOrder[c]!]!;
    }
  }
  return next;
}

function transpose(grid: Grid9): Grid9 {
  const next = cloneGrid9(grid);
  for (let r = 0; r < 9; r++) {
    for (let c = r + 1; c < 9; c++) {
      const t = next[r]![c]!;
      next[r]![c] = next[c]![r]!;
      next[c]![r] = t;
    }
  }
  return next;
}

function applyDigitPermutation(grid: Grid9, rng: () => number): Grid9 {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = 8; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = digits[i]!;
    digits[i] = digits[j]!;
    digits[j] = t;
  }
  const map = new Map<number, number>();
  for (let d = 1; d <= 9; d++) {
    map.set(d, digits[d - 1]!);
  }
  return grid.map((row) => row.map((v) => map.get(v)!));
}

/**
 * 生成随机**完整有效**数独解：对固定种子盘做数字置换、行/列带内置换与带间置换，并可选转置。
 *
 * 单次调用为 O(81) 级别，通常亚毫秒级；在实现约束下**不会失败**，返回类型为 {@link Grid9}。
 *
 * @param rng - 与 `[0, 1)` 一致的伪随机源。
 */
export function generateRandomCompleteGrid(rng: () => number): Grid9 {
  let g = cloneGrid9(SEED_SOLUTION);
  g = applyDigitPermutation(g, rng);
  g = permuteRows(g, rng);
  g = permuteCols(g, rng);
  if (rng() < 0.5) {
    g = transpose(g);
  }
  return g;
}
