/**
 * 通过 `@/lib/notes` 公共入口串联 `lib/core` fixture、`computeCandidates`、多步笔记命令与撤销栈；
 * 命名与 `lib/hint/integration.test.ts`、`lib/solver/integration.test.ts` 对齐。
 */
import { describe, expect, it } from "vitest";

import {
  createGameStateFromGivens,
  gameStateMeetsModelInvariants,
  serializeGameState,
  type GameState,
} from "@/lib/core";
import {
  ALMOST_SOLVED_ONE_EMPTY,
  SAMPLE_GIVENS_MINIMAL,
  SOLVED_GRID_SAMPLE,
} from "@/lib/core/fixture";
import { createMulberry32, generatePuzzle } from "@/lib/generator";
import { computeCandidates, type CandidatesGrid } from "@/lib/solver";

import {
  applyNotesCommand,
  cellsForBox,
  cellsForRow,
  createUndoStack,
  getHighlightCells,
  syncNotesWithCandidates,
} from "@/lib/notes";

const STABLE_MULBERRY = 0x9e3779b1;

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

describe("notes-logic barrel (@/lib/notes)", () => {
  it("fixture mid-game: toggle → sync → batchClear → setMode → sync; stack push/undo restores LIFO snapshots", () => {
    let state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    let candidates = computeCandidates(state);

    const r = 4;
    const c = 4;
    const digit = [...candidates[r][c]][0]!;

    const stack = createUndoStack();
    stack.push(state);

    state = applyNotesCommand(state, { type: "toggle", payload: { r, c, digit } }, candidates);
    candidates = computeCandidates(state);
    state = syncNotesWithCandidates(state, candidates);
    expect(gameStateMeetsModelInvariants(state)).toBe(true);

    stack.push(state);

    state = applyNotesCommand(
      state,
      { type: "batchClear", payload: { cells: [{ r, c }, { r, c: 5 }] } },
      candidates,
    );
    candidates = computeCandidates(state);
    state = applyNotesCommand(state, { type: "setMode", payload: { mode: "fill" } }, candidates);
    candidates = computeCandidates(state);
    state = syncNotesWithCandidates(state, candidates);

    expect(state.inputMode).toBe("fill");
    expect(state.cells[r][c].notes).toBeUndefined();
    expect(gameStateMeetsModelInvariants(state)).toBe(true);

    const backOne = stack.undo();
    expect(backOne).not.toBeNull();
    expect(serializeGameState(backOne!)).toBe(
      serializeGameState(
        (() => {
          let s = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
          let cand = computeCandidates(s);
          s = applyNotesCommand(s, { type: "toggle", payload: { r, c, digit } }, cand);
          cand = computeCandidates(s);
          return syncNotesWithCandidates(s, cand);
        })(),
      ),
    );

    const backZero = stack.undo();
    expect(backZero).not.toBeNull();
    expect(serializeGameState(backZero!)).toBe(
      serializeGameState(createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL)),
    );
    expect(stack.undo()).toBeNull();

    const rowH = getHighlightCells({ type: "row", index: r }, state, candidates);
    expectSameCellSet(rowH, [...cellsForRow(r)].map((p) => ({ r: p.r, c: p.c })));

    const boxH = getHighlightCells({ type: "box", index: 4 }, state, candidates);
    expectSameCellSet(boxH, [...cellsForBox(4)].map((p) => ({ r: p.r, c: p.c })));

    const digitH = getHighlightCells({ type: "digit", index: digit - 1 }, state, candidates);
    expectSameCellSet(digitH, expectedDigitHighlightCells(state, candidates, digit));
  });

  it("almost-solved grid: candidates + digit highlight for the last empty cell", () => {
    const state = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);
    const candidates = computeCandidates(state);
    expect(candidates[8][8]).toEqual(new Set([8]));

    const h = getHighlightCells({ type: "digit", index: 7 }, state, candidates);
    expectSameCellSet(h, [{ r: 8, c: 8 }]);
  });

  it("generator puzzle: full-board givens + computeCandidates + notes commands stay invariant", () => {
    const spec = generatePuzzle({
      tier: "easy",
      rng: createMulberry32(STABLE_MULBERRY),
    });
    let state = createGameStateFromGivens(spec.givens);
    let candidates = computeCandidates(state);

    let pick: { r: number; c: number; digit: number } | null = null;
    outer: for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const allowed = candidates[r][c];
        if (allowed.size === 0) continue;
        pick = { r, c, digit: [...allowed][0]! };
        break outer;
      }
    }
    expect(pick).not.toBeNull();

    const stack = createUndoStack();
    stack.push(state);

    state = applyNotesCommand(state, { type: "toggle", payload: pick! }, candidates);
    candidates = computeCandidates(state);
    state = syncNotesWithCandidates(state, candidates);

    expect(gameStateMeetsModelInvariants(state)).toBe(true);

    const restored = stack.undo();
    expect(restored).not.toBeNull();
    expect(serializeGameState(restored!)).toBe(
      serializeGameState(createGameStateFromGivens(spec.givens)),
    );
    expect(stack.undo()).toBeNull();
  });

  it("exports surface: undo command remains unsupported on applyNotesCommand", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const candidates = computeCandidates(state);
    expect(() =>
      applyNotesCommand(state, { type: "undo", payload: {} }, candidates),
    ).toThrow(/applyNotesCommand does not handle/);
  });
});
