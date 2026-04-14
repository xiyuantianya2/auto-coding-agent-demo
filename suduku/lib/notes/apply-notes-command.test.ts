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
