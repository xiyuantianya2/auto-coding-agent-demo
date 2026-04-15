import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_CELL, type CellState, type GameState, type Grid9 } from "@/lib/core";
import {
  findApplicableSteps,
  isRegisteredTechniqueId,
  MAX_FIND_APPLICABLE_MS,
  TechniqueIds,
  type SolveStep,
} from "@/lib/solver";
import * as solver from "@/lib/solver";

import { getNextHint } from "./index";

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

function makeState(grid: Grid9, cells: CellState[][]): GameState {
  return { grid, cells, mode: "fill" };
}

/** 与 `find-applicable-steps.test` 相同终盘；擦去一格后出现裸单。 */
const COMPLETE_SOLUTION: Grid9 = [
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

describe("getNextHint technique id contract (TechniqueIds / isRegisteredTechniqueId)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registered id: naked-single fixture matches solver first step and TechniqueIds.UniqueCandidate", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (r === 0 && c === 0) {
          continue;
        }
        grid[r][c] = COMPLETE_SOLUTION[r][c]!;
        cells[r][c] = { given: COMPLETE_SOLUTION[r][c]! };
      }
    }
    const state = makeState(grid, cells);

    const steps = findApplicableSteps(state);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0]!.technique).toBe(TechniqueIds.UniqueCandidate);
    expect(isRegisteredTechniqueId(steps[0]!.technique)).toBe(true);

    const hint = getNextHint(state);
    expect(hint).not.toBeNull();
    expect(hint!.technique).toBe(TechniqueIds.UniqueCandidate);
    expect(hint!.technique).toBe(steps[0]!.technique);
    expect(hint!.explanation.length).toBeGreaterThan(0);
  });

  it("registered id: second distinct TechniqueId is taken from findApplicableSteps[0] (spy)", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (r === 0 && c === 0) {
          continue;
        }
        grid[r][c] = COMPLETE_SOLUTION[r][c]!;
        cells[r][c] = { given: COMPLETE_SOLUTION[r][c]! };
      }
    }
    const state = makeState(grid, cells);

    const injected: SolveStep = {
      technique: TechniqueIds.HiddenSingle,
      highlights: [{ kind: "cell", ref: { r: 0, c: 0 } }],
      explanationKey: TechniqueIds.HiddenSingle,
    };

    const spy = vi.spyOn(solver, "findApplicableSteps").mockReturnValue([injected]);

    const hint = getNextHint(state);
    expect(hint).not.toBeNull();
    expect(hint!.technique).toBe(TechniqueIds.HiddenSingle);
    expect(isRegisteredTechniqueId(hint!.technique)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("unregistered / future extension id: string passthrough, no throw", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (r === 0 && c === 0) {
          continue;
        }
        grid[r][c] = COMPLETE_SOLUTION[r][c]!;
        cells[r][c] = { given: COMPLETE_SOLUTION[r][c]! };
      }
    }
    const state = makeState(grid, cells);

    const customId = "custom-future-extension-technique";
    const injected: SolveStep = {
      technique: customId,
      highlights: [{ kind: "cell", ref: { r: 0, c: 0 } }],
    };

    vi.spyOn(solver, "findApplicableSteps").mockReturnValue([injected]);

    expect(isRegisteredTechniqueId(customId)).toBe(false);
    expect(() => getNextHint(state)).not.toThrow();
    expect(getNextHint(state)!.technique).toBe(customId);
  });

  it(
    "pathological heavy grid: structural smoke only; bounded by findApplicableSteps wall clock",
    { timeout: 120_000 },
    () => {
      // 故意使用「每格候选极多、技巧扫描路径长」的输入；不做随机压测、不断言最少步数。
      // 行为依赖 `findApplicableSteps` 的 MAX_FIND_APPLICABLE_MS 早停与 MAX_FIND_APPLICABLE_EMITTED_STEPS 上限。
      expect(MAX_FIND_APPLICABLE_MS).toBeGreaterThan(0);

      const grid = makeEmptyGrid();
      const cells = makeEmptyCells();
      const state = makeState(grid, cells);

      expect(() => getNextHint(state)).not.toThrow();
      const hint = getNextHint(state);
      if (hint === null) {
        return;
      }
      expect(typeof hint.technique).toBe("string");
      expect(hint.technique.length).toBeGreaterThan(0);
      expect(Array.isArray(hint.cells)).toBe(true);
      expect(hint.explanation.length).toBeGreaterThan(0);
    },
  );
});
