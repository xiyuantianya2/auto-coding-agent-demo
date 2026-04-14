import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "./constants";
import {
  cloneGameState,
  deserializeGameState,
  hasRuleConflict,
  isBoardFilled,
  isLegalFill,
  isLegalToggleNote,
  isValidPlacement,
  isVictory,
  serializeGameState,
} from "./index";
import type { CellState, GameState, Grid9 } from "./types";

/** 合法完整解答（标准 9×9），与模块内其它用例一致，用于满盘/胜利回归。 */
const VALID_COMPLETE: number[][] = [
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

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

function expectGameStatesEqual(a: GameState, b: GameState): void {
  expect(a.mode).toBe(b.mode);
  expect(a.grid).toEqual(b.grid);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      expect(a.cells[r][c].given).toBe(b.cells[r][c].given);
      expect(a.cells[r][c].value).toBe(b.cells[r][c].value);
      const an = a.cells[r][c].notes;
      const bn = b.cells[r][c].notes;
      if (an === undefined && bn === undefined) {
        continue;
      }
      expect(an).toBeDefined();
      expect(bn).toBeDefined();
      expect([...(an as Set<number>)].sort((x, y) => x - y)).toEqual(
        [...(bn as Set<number>)].sort((x, y) => x - y),
      );
    }
  }
}

/** 测试内模拟落子：调用方需已用 `isLegalFill` 等确认合法。 */
function applyPlayerFill(state: GameState, r: number, c: number, n: number): void {
  state.grid[r][c] = n;
  const prev = state.cells[r][c];
  state.cells[r][c] = { given: prev.given, value: n };
}

/** 在 `notes` 模式下切换笔记（与 `isLegalToggleNote` 搭配使用）。 */
function applyToggleNote(state: GameState, r: number, c: number, n: number): void {
  const cell = state.cells[r][c];
  const next = new Set(cell.notes ?? []);
  if (next.has(n)) {
    next.delete(n);
  } else {
    next.add(n);
  }
  state.cells[r][c] = {
    ...cell,
    notes: next.size > 0 ? next : undefined,
  };
}

function stateFromDigitGrid(rows: number[][], useGiven: boolean, mode: GameState["mode"]): GameState {
  const grid: Grid9 = rows.map((row) => [...row]);
  const cells: CellState[][] = rows.map((row) =>
    row.map((n) => (useGiven ? { given: n } : { value: n })),
  );
  return { grid, cells, mode };
}

describe("core-model integration: placement → clone → serialize roundtrip → outcome", () => {
  it("chains legal fill, clone, JSON roundtrip, and conflict/victory flags on a partial board", () => {
    const base: GameState = {
      grid: makeEmptyGrid(),
      cells: makeEmptyCells(),
      mode: "fill",
    };

    expect(isValidPlacement(base, 0, 0, 5)).toBe(true);
    expect(isLegalFill(base, 0, 0, 5)).toBe(true);

    const working = cloneGameState(base);
    applyPlayerFill(working, 0, 0, 5);

    const json = serializeGameState(working);
    const restored = deserializeGameState(json);
    expectGameStatesEqual(working, restored);

    expect(isBoardFilled(restored)).toBe(false);
    expect(hasRuleConflict(restored)).toBe(false);
    expect(isVictory(restored)).toBe(false);

    const clonedAgain = cloneGameState(restored);
    expect(clonedAgain.grid).not.toBe(restored.grid);
    expect(clonedAgain.cells).not.toBe(restored.cells);
    expect(clonedAgain.cells[0][0]).not.toBe(restored.cells[0][0]);
    expectGameStatesEqual(restored, clonedAgain);
  });

  it("preserves givens and redundant value under the same cell through roundtrip", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][0] = 7;
    cells[0][0] = { given: 7, value: 3 };

    const state: GameState = { grid, cells, mode: "fill" };
    expect(isValidPlacement(state, 1, 1, 7)).toBe(false);
    expect(isLegalFill(state, 1, 1, 9)).toBe(true);

    const round = deserializeGameState(serializeGameState(cloneGameState(state)));
    expect(round.cells[0][0].given).toBe(7);
    expect(round.cells[0][0].value).toBe(3);
    expect(round.grid[0][0]).toBe(7);
    expect(hasRuleConflict(round)).toBe(false);
  });

  it("roundtrips empty notes (undefined / empty Set) and fill mode", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[2][3] = { notes: new Set() };
    const state: GameState = { grid, cells, mode: "fill" };

    const back = deserializeGameState(serializeGameState(cloneGameState(state)));
    expect(back.cells[2][3].notes).toBeUndefined();
    expect(back.mode).toBe("fill");
  });

  it("preserves notes mode and non-empty notes through clone and serialize", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[4][4] = { notes: new Set([2, 9, 5]) };
    const state: GameState = { grid, cells, mode: "notes" };

    expect(isLegalToggleNote(state, 4, 4, 1)).toBe(true);
    const working = cloneGameState(state);
    applyToggleNote(working, 4, 4, 1);

    const back = deserializeGameState(serializeGameState(working));
    expect(back.mode).toBe("notes");
    expect([...(back.cells[4][4].notes ?? [])].sort((a, b) => a - b)).toEqual([1, 2, 5, 9]);
    expect(isBoardFilled(back)).toBe(false);
    expect(isVictory(back)).toBe(false);
  });

  it("reports victory on a full valid grid after roundtrip", () => {
    const filled = stateFromDigitGrid(VALID_COMPLETE, false, "fill");
    expect(isVictory(filled)).toBe(true);

    const pipe = deserializeGameState(serializeGameState(cloneGameState(filled)));
    expect(isBoardFilled(pipe)).toBe(true);
    expect(hasRuleConflict(pipe)).toBe(false);
    expect(isVictory(pipe)).toBe(true);
  });

  it("detects conflict on a full board with duplicates after roundtrip", () => {
    const rows = VALID_COMPLETE.map((row) => [...row]);
    rows[0][2] = rows[0][0];
    const bad = stateFromDigitGrid(rows, false, "notes");

    expect(isBoardFilled(bad)).toBe(true);
    expect(hasRuleConflict(bad)).toBe(true);
    expect(isVictory(bad)).toBe(false);

    const pipe = deserializeGameState(serializeGameState(cloneGameState(bad)));
    expect(isVictory(pipe)).toBe(false);
    expect(hasRuleConflict(pipe)).toBe(true);
  });

  it("keeps mode field distinct for fill vs notes across identical grid snapshot", () => {
    const grid = VALID_COMPLETE.map((row) => [...row]);
    const cells: CellState[][] = grid.map((row) =>
      row.map((n) => ({ value: n })),
    );
    const asFill: GameState = { grid, cells, mode: "fill" };
    const asNotes: GameState = { ...cloneGameState(asFill), mode: "notes" };

    expect(serializeGameState(asFill)).not.toBe(serializeGameState(asNotes));
    expect(deserializeGameState(serializeGameState(asFill)).mode).toBe("fill");
    expect(deserializeGameState(serializeGameState(asNotes)).mode).toBe("notes");
  });
});
