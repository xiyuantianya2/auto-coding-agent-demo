import type { Grid9 } from "@/lib/core";
import { EMPTY_CELL, GRID_SIZE } from "@/lib/core";

const CELL_COUNT = GRID_SIZE * GRID_SIZE;

/**
 * 单次调用在回溯搜索中允许展开的最大 DFS 节点数（含根调用）。
 * 超过则中止并返回 `false`（无法在无界时间内保证唯一性结论；上层可重试或换题）。
 */
const DEFAULT_MAX_DFS_NODES = 12_000_000;

/**
 * 单次调用的墙上时钟预算（毫秒）。超过则中止并返回 `false`。
 * 与 {@link DEFAULT_MAX_DFS_NODES} 组合使用，避免极端输入单次卡死。
 */
const DEFAULT_MAX_ELAPSED_MS = 5000;

function boxIndex(r: number, c: number): number {
  return (Math.floor(r / 3) * 3 + Math.floor(c / 3)) | 0;
}

/**
 * 在标准数独规则下判断 `givens` 是否**恰有一个**完整解。
 *
 * 使用位掩码行/列/宫约束 + 回溯；与 `findApplicableSteps` 的人类技巧链无关。
 * 找到第二个解即早停。若初始提示自相矛盾则视为无解（`false`）。
 *
 * **预算与 `false` 的含义**：达到 {@link DEFAULT_MAX_DFS_NODES} 或
 * {@link DEFAULT_MAX_ELAPSED_MS} 时中止；此时返回 `false`（未能在预算内证明唯一解）。
 * 这与「多解/无解」在调用方均可视为「未通过唯一性校验」，上层可重试。
 */
export function verifyUniqueSolution(givens: Grid9): boolean {
  if (!Array.isArray(givens) || givens.length !== GRID_SIZE) {
    return false;
  }

  const cells = new Uint8Array(CELL_COUNT);
  const rows = new Uint16Array(GRID_SIZE);
  const cols = new Uint16Array(GRID_SIZE);
  const boxes = new Uint16Array(GRID_SIZE);

  for (let r = 0; r < GRID_SIZE; r++) {
    const row = givens[r];
    if (!Array.isArray(row) || row.length !== GRID_SIZE) {
      return false;
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      const raw = row[c];
      const v =
        typeof raw === "number" && Number.isInteger(raw) ? raw : EMPTY_CELL;
      const idx = r * GRID_SIZE + c;

      if (v === EMPTY_CELL) {
        continue;
      }
      if (v < 1 || v > 9) {
        return false;
      }

      const bit = 1 << (v - 1);
      const bi = boxIndex(r, c);
      if ((rows[r]! & bit) !== 0 || (cols[c]! & bit) !== 0 || (boxes[bi]! & bit) !== 0) {
        return false;
      }
      rows[r]! |= bit;
      cols[c]! |= bit;
      boxes[bi]! |= bit;
      cells[idx] = v;
    }
  }

  let solutionCount = 0;
  let dfsNodes = 0;
  let aborted = false;
  const t0 = Date.now();

  function overBudget(): boolean {
    if (dfsNodes >= DEFAULT_MAX_DFS_NODES) {
      return true;
    }
    return Date.now() - t0 > DEFAULT_MAX_ELAPSED_MS;
  }

  function dfs(): void {
    if (solutionCount >= 2) {
      return;
    }
    if (overBudget()) {
      aborted = true;
      return;
    }
    dfsNodes++;

    let pos = -1;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (cells[i] === 0) {
        pos = i;
        break;
      }
    }

    if (pos === -1) {
      solutionCount++;
      return;
    }

    const r = Math.floor(pos / GRID_SIZE);
    const c = pos % GRID_SIZE;
    const bi = boxIndex(r, c);
    const used = rows[r]! | cols[c]! | boxes[bi]!;

    for (let d = 1; d <= 9; d++) {
      if (solutionCount >= 2) {
        return;
      }
      const bit = 1 << (d - 1);
      if ((used & bit) !== 0) {
        continue;
      }

      rows[r]! ^= bit;
      cols[c]! ^= bit;
      boxes[bi]! ^= bit;
      cells[pos] = d;

      dfs();

      cells[pos] = 0;
      rows[r]! ^= bit;
      cols[c]! ^= bit;
      boxes[bi]! ^= bit;

      if (solutionCount >= 2) {
        return;
      }
    }
  }

  dfs();

  if (aborted) {
    return false;
  }
  return solutionCount === 1;
}
