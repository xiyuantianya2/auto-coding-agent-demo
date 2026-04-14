import { describe, expect, it } from "vitest";
import {
  cloneGameState,
  createGameStateFromGivens,
  deserializeGameState,
  serializeGameState,
} from "@/lib/core";
import { SAMPLE_GIVENS_MINIMAL } from "@/lib/core/fixture";
import { computeCandidates } from "@/lib/solver";

import { applyNotesCommandImpl } from "./apply-notes-command";

describe("applyNotesCommand (batchClear)", () => {
  it("batchClear: clears notes on multiple editable cells in list order", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const a = { r: 4, c: 4 };
    const b = { r: 4, c: 5 };
    const d0 = [...candidates[a.r][a.c]][0];
    const d1 = [...candidates[b.r][b.c]][0];

    let cur = applyNotesCommandImpl(
      state,
      { type: "toggle", payload: { ...a, digit: d0 } },
      candidates,
    );
    cur = applyNotesCommandImpl(cur, { type: "toggle", payload: { ...b, digit: d1 } }, candidates);
    expect(cur.cells[a.r][a.c].notes?.size).toBeGreaterThan(0);
    expect(cur.cells[b.r][b.c].notes?.size).toBeGreaterThan(0);

    const cleared = applyNotesCommandImpl(
      cur,
      { type: "batchClear", payload: { cells: [a, b] } },
      candidates,
    );
    expect(cleared.cells[a.r][a.c].notes).toBeUndefined();
    expect(cleared.cells[b.r][b.c].notes).toBeUndefined();
    expect(cleared).not.toBe(cur);
  });

  it("batchClear: skips givens and leaves them unchanged", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const givenR = 0;
    const givenC = 0;
    const r = 4;
    const c = 4;
    const digit = [...candidates[r][c]][0];

    const withNote = applyNotesCommandImpl(
      state,
      { type: "toggle", payload: { r, c, digit } },
      candidates,
    );
    const next = applyNotesCommandImpl(
      withNote,
      {
        type: "batchClear",
        payload: { cells: [{ r: givenR, c: givenC }, { r, c }] },
      },
      candidates,
    );
    expect(next.cells[givenR][givenC].given).toBe(state.cells[givenR][givenC].given);
    expect(next.cells[r][c].notes).toBeUndefined();
  });

  it("batchClear: empty cells list clones and syncs (no crash, stable vs candidates)", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const next = applyNotesCommandImpl(state, { type: "batchClear", payload: { cells: [] } }, candidates);
    expect(next).not.toBe(state);
    expect(next.cells).toEqual(state.cells);
  });

  it("batchClear: region row expands and clears in row-major order (smoke)", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const r = 4;
    let cur = state;
    for (let c = 0; c < 9; c++) {
      const digit = [...candidates[r][c]][0];
      if (candidates[r][c].size === 0) continue;
      cur = applyNotesCommandImpl(cur, { type: "toggle", payload: { r, c, digit } }, candidates);
    }
    const cleared = applyNotesCommandImpl(
      cur,
      { type: "batchClear", payload: { region: "row", index: r } },
      candidates,
    );
    for (let c = 0; c < 9; c++) {
      if (candidates[r][c].size > 0 && state.cells[r][c].given === undefined) {
        expect(cleared.cells[r][c].notes?.size ?? 0).toBe(0);
      }
    }
  });
});

describe("applyNotesCommand (toggle / clearCell / setMode)", () => {
  it("toggle: adds a candidate pencil mark on an empty editable cell", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const r = 4;
    const c = 4;
    const digit = [...candidates[r][c]][0];

    const next = applyNotesCommandImpl(
      state,
      { type: "toggle", payload: { r, c, digit } },
      candidates,
    );

    expect(next.cells[r][c].notes?.has(digit)).toBe(true);
    expect(next).not.toBe(state);
  });

  it("toggle: removes a pencil mark when the digit is already noted", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const r = 4;
    const c = 4;
    const digit = [...candidates[r][c]][0];

    const once = applyNotesCommandImpl(
      state,
      { type: "toggle", payload: { r, c, digit } },
      candidates,
    );
    const twice = applyNotesCommandImpl(
      once,
      { type: "toggle", payload: { r, c, digit } },
      candidates,
    );

    expect(twice.cells[r][c].notes?.has(digit) ?? false).toBe(false);
  });

  it("toggle: rejects givens and digits not in the candidate set (illegal add)", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const givenR = 0;
    const givenC = 0;

    const onGiven = applyNotesCommandImpl(
      state,
      { type: "toggle", payload: { r: givenR, c: givenC, digit: 1 } },
      candidates,
    );
    expect(onGiven.cells[givenR][givenC].notes?.size ?? 0).toBe(0);

    const r = 4;
    const c = 4;
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !candidates[r][c].has(d))!;
    const onBad = applyNotesCommandImpl(
      state,
      { type: "toggle", payload: { r, c, digit: wrong } },
      candidates,
    );
    expect(onBad).toEqual(state);
  });

  it("clearCell: clears notes on an editable empty cell", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const r = 4;
    const c = 4;
    const digit = [...candidates[r][c]][0];
    const withNote = applyNotesCommandImpl(
      state,
      { type: "toggle", payload: { r, c, digit } },
      candidates,
    );
    expect(withNote.cells[r][c].notes?.size).toBeGreaterThan(0);

    const cleared = applyNotesCommandImpl(
      withNote,
      { type: "clearCell", payload: { r, c } },
      candidates,
    );
    expect(cleared.cells[r][c].notes).toBeUndefined();
  });

  it("clearCell: does not modify givens", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const next = applyNotesCommandImpl(
      state,
      { type: "clearCell", payload: { r: 0, c: 0 } },
      candidates,
    );
    expect(next).toEqual(state);
  });

  it("setMode: writes inputMode and syncs notes with candidates", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const r = 4;
    const c = 4;
    const allowed = candidates[r][c];
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !allowed.has(d))!;

    const dirty = cloneGameState(state);
    dirty.cells[r][c].notes = new Set([...allowed, wrong]);

    const next = applyNotesCommandImpl(
      dirty,
      { type: "setMode", payload: { mode: "notes" } },
      candidates,
    );

    expect(next.inputMode).toBe("notes");
    expect(next.cells[r][c].notes).toEqual(allowed);
  });

  it("setMode: serialize / deserialize preserves inputMode (archive compatibility)", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    state.inputMode = "notes";
    const json = serializeGameState(state);
    const back = deserializeGameState(json);
    expect(back.inputMode).toBe("notes");
    expect(deserializeGameState(serializeGameState(back))).toEqual(cloneGameState(back));
  });
});
