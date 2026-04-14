/**
 * Task 7：串联 `computeCandidates` 与公开 API 的「端到端」单元场景（非浏览器 E2E）。
 */

import { describe, expect, it } from "vitest";
import {
  createGameStateFromGivens,
  gameStateMeetsModelInvariants,
  type GameState,
} from "@/lib/core";
import { SAMPLE_GIVENS_MINIMAL } from "@/lib/core/fixture";
import { computeCandidates, type CandidatesGrid } from "@/lib/solver";

import {
  applyNotesCommand,
  cellsForRow,
  getHighlightCells,
  syncNotesWithCandidates,
} from "./index";

function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

function expectSameCellSet(
  actual: Readonly<{ cells: readonly Readonly<{ r: number; c: number }>[] }>,
  expected: Array<{ r: number; c: number }>,
): void {
  const a = new Set(actual.cells.map((p) => coordKey(p.r, p.c)));
  const e = new Set(expected.map((p) => coordKey(p.r, p.c)));
  expect(a).toEqual(e);
}

/** 与 `highlight-filter` 中 digit 语义一致的预期集合（未解格 ∩ (候选∪笔记)）。 */
function expectedDigitHighlightCells(
  state: GameState,
  candidates: CandidatesGrid,
  digit: number,
): Array<{ r: number; c: number }> {
  const out: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = state.cells[r][c];
      if (cell.given !== undefined || cell.value !== undefined) continue;
      if (candidates[r][c].has(digit) || (cell.notes?.has(digit) ?? false)) {
        out.push({ r, c });
      }
    }
  }
  return out;
}

describe("applyNotesCommand flow (toggle → sync → batchClear → setMode → sync)", () => {
  it("recomputes candidates between steps; final state meets core invariants; highlights match helpers", () => {
    let state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    let candidates = computeCandidates(state);

    const r = 4;
    const c = 4;
    const digit = [...candidates[r][c]][0];

    // toggle
    state = applyNotesCommand(state, { type: "toggle", payload: { r, c, digit } }, candidates);
    expect(state.cells[r][c].notes?.has(digit)).toBe(true);
    candidates = computeCandidates(state);

    // sync（典型序列中显式调用，与 UI 在填数后「收紧笔记」一致）
    state = syncNotesWithCandidates(state, candidates);
    expect(gameStateMeetsModelInvariants(state)).toBe(true);

    // 联调：digit 高亮在含笔记盘面上包含当前格
    const midDigit = getHighlightCells({ type: "digit", index: digit - 1 }, state, candidates);
    expectSameCellSet(midDigit, expectedDigitHighlightCells(state, candidates, digit));
    expect(midDigit.cells.some((p) => p.r === r && p.c === c)).toBe(true);

    // batchClear（两格）
    const c2 = 5;
    state = applyNotesCommand(
      state,
      { type: "batchClear", payload: { cells: [{ r, c }, { r, c: c2 }] } },
      candidates,
    );
    expect(state.cells[r][c].notes).toBeUndefined();
    candidates = computeCandidates(state);

    // setMode（内部会 sync）
    state = applyNotesCommand(state, { type: "setMode", payload: { mode: "fill" } }, candidates);
    expect(state.inputMode).toBe("fill");
    candidates = computeCandidates(state);

    // 最终 sync
    state = syncNotesWithCandidates(state, candidates);

    expect(gameStateMeetsModelInvariants(state)).toBe(true);
    expect(state.cells[r][c].notes).toBeUndefined();

    const rowH = getHighlightCells({ type: "row", index: r }, state, candidates);
    expectSameCellSet(rowH, [...cellsForRow(r)].map((p) => ({ r: p.r, c: p.c })));

    const digitH = getHighlightCells({ type: "digit", index: digit - 1 }, state, candidates);
    expectSameCellSet(digitH, expectedDigitHighlightCells(state, candidates, digit));
  });
});

describe("NotesCommand surface (all branches)", () => {
  it("toggle | clearCell | batchClear | setMode apply; undo throws (use createUndoStack)", () => {
    const base = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(base);
    const r = 3;
    const c = 3;
    const d = [...candidates[r][c]][0];

    const toggled = applyNotesCommand(base, { type: "toggle", payload: { r, c, digit: d } }, candidates);
    expect(toggled).not.toBe(base);

    const cleared = applyNotesCommand(
      toggled,
      { type: "clearCell", payload: { r, c } },
      candidates,
    );
    expect(cleared.cells[r][c].notes).toBeUndefined();

    const batched = applyNotesCommand(
      cleared,
      { type: "batchClear", payload: { cells: [{ r: 1, c: 1 }] } },
      candidates,
    );
    expect(batched).not.toBe(cleared);

    const mode = applyNotesCommand(
      batched,
      { type: "setMode", payload: { mode: "notes" } },
      candidates,
    );
    expect(mode.inputMode).toBe("notes");

    expect(() =>
      applyNotesCommand(mode, { type: "undo", payload: {} }, candidates),
    ).toThrow(/applyNotesCommand does not handle/);
  });
});
