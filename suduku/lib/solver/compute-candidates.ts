import {
  BOARD_SIZE,
  DIGIT_MAX,
  DIGIT_MIN,
  EMPTY_CELL,
  findObviousConflictPositions,
  gameStateMeetsModelInvariants,
  gridFromGameState,
  hasObviousConflict,
  isValidPlacement,
} from "../core";
import type { GameState } from "../core";
import { createEmptyCandidatesGrid } from "./candidates";
import type { CandidatesGrid } from "./types";

/**
 * 候选计算失败时的统一错误（与 {@link computeCandidates} 配套）。
 *
 * - **`model_invariant`**：`GameState` 不满足 {@link gameStateMeetsModelInvariants}（例如同时存在 `given` 与 `value`）。
 * - **`obvious_conflict`**：行/列/宫内出现重复非零数字（与 {@link hasObviousConflict} 一致）。
 * - **`empty_cell_candidates`**：某空格在规则下无任何可放置数字（1–9 均被排除），盘面不可继续。
 */
export type CandidatesComputationErrorKind =
  | "model_invariant"
  | "obvious_conflict"
  | "empty_cell_candidates";

export type CandidatesComputationErrorDetails =
  | { kind: "model_invariant" }
  | { kind: "obvious_conflict"; positions: Array<{ r: number; c: number }> }
  | { kind: "empty_cell_candidates"; r: number; c: number };

export class CandidatesComputationError extends Error {
  override readonly name = "CandidatesComputationError";

  readonly details: CandidatesComputationErrorDetails;

  constructor(message: string, details: CandidatesComputationErrorDetails) {
    super(message);
    this.details = details;
  }
}

/**
 * 从当前盘面计算 9×9 候选网格（与 `GameState.cells` 同索引）。
 *
 * - **已解格**（`given` 或 `value`）：候选为空集（无待选数字）。
 * **空格**（紧凑网格为 {@link EMPTY_CELL}）：对每个 `n ∈ [1,9]`，当且仅当
 * {@link isValidPlacement}`(grid, r, c, n)` 为真时把 `n` 放入该格候选集；`grid` 来自
 * {@link gridFromGameState}`(state)`。
 *
 * **错误与诊断**（不返回部分结果）：
 *
 * 1. 模型不变式失败 → {@link CandidatesComputationError}，`kind: 'model_invariant'`。
 * 2. 明显冲突 → `kind: 'obvious_conflict'`，`details.positions` 为
 *    {@link findObviousConflictPositions} 的列表（可能含重复坐标，与 core 一致）。
 * 3. 无冲突但某空格候选为空 → `kind: 'empty_cell_candidates'`，`details` 含该格 `(r,c)`。
 *
 * 不修改 `state`；不包含技巧搜索或回溯求解。
 */
export function computeCandidates(state: GameState): CandidatesGrid {
  if (!gameStateMeetsModelInvariants(state)) {
    throw new CandidatesComputationError("GameState violates model invariants.", {
      kind: "model_invariant",
    });
  }
  if (hasObviousConflict(state)) {
    throw new CandidatesComputationError("Board has an obvious duplicate digit in a row, column, or box.", {
      kind: "obvious_conflict",
      positions: findObviousConflictPositions(state),
    });
  }

  const grid = gridFromGameState(state);
  const out = createEmptyCandidatesGrid();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const set = out[r][c];
      if (grid[r][c] !== EMPTY_CELL) {
        set.clear();
        continue;
      }
      for (let n = DIGIT_MIN; n <= DIGIT_MAX; n++) {
        if (isValidPlacement(grid, r, c, n)) {
          set.add(n);
        }
      }
      if (set.size === 0) {
        throw new CandidatesComputationError(
          `No valid digit for empty cell at (${r},${c}) under current givens.`,
          { kind: "empty_cell_candidates", r, c },
        );
      }
    }
  }

  return out;
}

/**
 * 将候选网格转为稳定快照（用于测试）：每格为升序数字拼接字符串；已解格（空集）为 `""`。
 */
export function candidatesGridToSnapshot(grid: CandidatesGrid): string[][] {
  return grid.map((row) =>
    row.map((set) =>
      [...set]
        .sort((a, b) => a - b)
        .join(""),
    ),
  );
}
