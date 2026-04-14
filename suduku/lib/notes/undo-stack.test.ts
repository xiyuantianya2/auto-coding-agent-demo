import { describe, expect, it } from "vitest";
import { cloneGameState, createGameStateFromGivens } from "@/lib/core";
import { SAMPLE_GIVENS_MINIMAL } from "@/lib/core/fixture";
import { computeCandidates } from "@/lib/solver";

import { applyNotesCommandImpl } from "./apply-notes-command";
import { createUndoStack } from "./undo-stack";

describe("createUndoStack", () => {
  it("push / undo 多次：后进先出", () => {
    const s0 = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(s0);
    const s1 = applyNotesCommandImpl(
      s0,
      { type: "toggle", payload: { r: 4, c: 4, digit: [...candidates[4][4]][0] } },
      candidates,
    );

    const stack = createUndoStack();
    stack.push(s0);
    stack.push(s1);

    expect(stack.undo()).toEqual(s1);
    expect(stack.undo()).toEqual(s0);
    expect(stack.undo()).toBeNull();
  });

  it("空栈 undo 返回 null", () => {
    const stack = createUndoStack();
    expect(stack.undo()).toBeNull();
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    stack.push(state);
    expect(stack.undo()).not.toBeNull();
    expect(stack.undo()).toBeNull();
  });

  it("克隆独立性：修改 undo 返回值不污染栈内剩余快照", () => {
    const base = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(base);
    const a = cloneGameState(base);
    const digit = [...candidates[4][4]][0];
    const b = applyNotesCommandImpl(
      base,
      { type: "toggle", payload: { r: 4, c: 4, digit } },
      candidates,
    );

    const stack = createUndoStack();
    stack.push(a);
    stack.push(b);

    const poppedB = stack.undo();
    expect(poppedB).not.toBeNull();
    poppedB!.cells[0][0].value = 99;
    poppedB!.cells[4][4].notes = new Set([1, 2, 3]);

    const poppedA = stack.undo();
    expect(poppedA).not.toBeNull();
    expect(poppedA!.cells[0][0].value).toBe(a.cells[0][0].value);
    expect(poppedA!.cells[4][4].notes?.has(digit) ?? false).toBe(false);
  });

  it("push 入栈后与入参引用脱钩（修改入参不改动栈内快照）", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const stack = createUndoStack();
    stack.push(state);
    state.cells[5][5].value = 7;

    const restored = stack.undo();
    expect(restored!.cells[5][5].value).toBeUndefined();
  });
});
