import { describe, expect, it } from "vitest";
import { CellSymbol, DEFAULT_CELL_SYMBOLS, EMPTY_CELL, type Board } from "./board-types";
import { createInitialBoard } from "./create-initial-board";
import { BASE_SCORE_PER_CELL } from "./match-clear";
import { mulberry32 } from "./seeded-random";
import { attemptAdjacentSwap, findFirstValidSwap } from "./swap-legality";
import {
  applyGravityAndRefill,
  applyTripleClear,
  stabilizeAfterSwap,
} from "./stabilization";
import {
  buildStabilizationStepSequence,
  buildStabilizationStepSequenceFromAcceptedSwap,
} from "./stabilization-steps";

function boardFromLines(lines: (CellSymbol | typeof EMPTY_CELL)[][]): Board {
  return lines.map((row) => Object.freeze([...row])) as Board;
}

/** 按步骤序列逐步执行「三消 → 重力补位」，须与 `buildStabilizationStepSequence` 一致 */
function applySequenceWaveByWave(
  boardAfterAcceptedSwap: Board,
  sequence: ReturnType<typeof buildStabilizationStepSequence>,
  options: { readonly refillSeed: number; readonly symbols?: typeof DEFAULT_CELL_SYMBOLS },
): { readonly board: Board; readonly totalScore: number; readonly refillSeedAfter: number } {
  let b = boardAfterAcceptedSwap;
  let workingSeed = options.refillSeed >>> 0;
  let totalScore = 0;

  for (const step of sequence.steps) {
    expect(workingSeed).toBe(step.refillSeedBeforeGravityRefill);
    const cleared = applyTripleClear(b);
    expect(cleared.board).toEqual(step.boardAfterClear);
    expect(cleared.score).toBe(step.baseScore);

    const rnd = mulberry32(workingSeed);
    const after = applyGravityAndRefill(cleared.board, {
      random: rnd,
      symbols: options.symbols,
    });
    expect(after).toEqual(step.boardAfterGravityRefill);

    totalScore += step.scoreDelta;
    b = after;
    workingSeed = (workingSeed + 0x9e37_79b9) >>> 0;
  }

  return { board: b, totalScore, refillSeedAfter: workingSeed };
}

describe("buildStabilizationStepSequence", () => {
  it("matches stabilizeAfterSwap on a simple triple row", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    const refillSeed = 7;
    const stab = stabilizeAfterSwap(b, { refillSeed, symbols: DEFAULT_CELL_SYMBOLS });
    const seq = buildStabilizationStepSequence(b, { refillSeed, symbols: DEFAULT_CELL_SYMBOLS });

    expect(seq.finalBoard).toEqual(stab.board);
    expect(seq.totalScore).toBe(stab.score);
    expect(seq.chainWaves).toBe(stab.chainWaves);
    expect(seq.tripleClearedCells).toBe(stab.tripleClearedCells);
    expect(seq.refillSeedAfter).toBe(stab.refillSeedAfter);
    expect(seq.steps).toHaveLength(stab.chainWaves);

    const replay = applySequenceWaveByWave(b, seq, { refillSeed, symbols: DEFAULT_CELL_SYMBOLS });
    expect(replay.board).toEqual(stab.board);
    expect(replay.totalScore).toBe(stab.score);
    expect(replay.refillSeedAfter).toBe(stab.refillSeedAfter);
  });

  it("matches when there are no triples (empty steps)", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Ruby, CellSymbol.Emerald],
    ]);
    const stab = stabilizeAfterSwap(b, { refillSeed: 1 });
    const seq = buildStabilizationStepSequence(b, { refillSeed: 1 });
    expect(seq.steps).toHaveLength(0);
    expect(seq.finalBoard).toEqual(stab.board);
    expect(seq.totalScore).toBe(0);
    expect(seq.refillSeedAfter).toBe(1 >>> 0);
  });

  it("buildStabilizationStepSequenceFromAcceptedSwap returns null when swap not accepted", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Ruby, CellSymbol.Emerald],
    ]);
    const rej = attemptAdjacentSwap(b, { row: 0, col: 0 }, { row: 1, col: 0 });
    expect(rej.kind).toBe("rejected");
    expect(
      buildStabilizationStepSequenceFromAcceptedSwap(rej, { refillSeed: 1 }),
    ).toBeNull();
  });

  it("fixed seed: step-by-step replay matches pipeline (random initial board + first valid swap)", () => {
    const boardSeed = 2026;
    const refillSeed = 0x2026_0414;
    const board = createInitialBoard({
      rows: 6,
      cols: 6,
      random: mulberry32(boardSeed),
    });
    const pair = findFirstValidSwap(board);
    expect(pair).not.toBeNull();
    const [a, b] = pair!;
    const res = attemptAdjacentSwap(board, a, b);
    expect(res.kind).toBe("accepted");

    const stab = stabilizeAfterSwap(res.board, { refillSeed });
    const seq = buildStabilizationStepSequence(res.board, { refillSeed });
    const fromSwap = buildStabilizationStepSequenceFromAcceptedSwap(res, { refillSeed });
    expect(fromSwap).not.toBeNull();
    expect(fromSwap).toEqual(seq);

    expect(seq.finalBoard).toEqual(stab.board);
    expect(seq.totalScore).toBe(stab.score);
    expect(seq.chainWaves).toBe(stab.chainWaves);
    expect(seq.tripleClearedCells).toBe(stab.tripleClearedCells);
    expect(seq.refillSeedAfter).toBe(stab.refillSeedAfter);
    expect(seq.steps).toHaveLength(stab.chainWaves);

    const replay = applySequenceWaveByWave(res.board, seq, { refillSeed });
    expect(replay.board).toEqual(stab.board);
    expect(replay.totalScore).toBe(stab.score);
    expect(replay.refillSeedAfter).toBe(stab.refillSeedAfter);
  });

  it("multi-wave chain: each wave is one playable step and subsequence sums to total score", () => {
    let found: {
      readonly boardAfterSwap: Board;
      readonly refillSeed: number;
    } | null = null;

    for (let boardSeed = 0; boardSeed < 2000; boardSeed += 1) {
      const board = createInitialBoard({
        rows: 6,
        cols: 6,
        random: mulberry32(boardSeed),
      });
      const pair = findFirstValidSwap(board);
      if (!pair) {
        continue;
      }
      const res = attemptAdjacentSwap(board, pair[0], pair[1]);
      if (res.kind !== "accepted") {
        continue;
      }
      const refillSeed = 0xace5eed;
      const stab = stabilizeAfterSwap(res.board, { refillSeed });
      if (stab.chainWaves >= 2) {
        found = { boardAfterSwap: res.board, refillSeed };
        break;
      }
    }

    expect(found).not.toBeNull();
    const { boardAfterSwap, refillSeed } = found!;

    const stab = stabilizeAfterSwap(boardAfterSwap, { refillSeed });
    const seq = buildStabilizationStepSequence(boardAfterSwap, { refillSeed });

    expect(stab.chainWaves).toBeGreaterThanOrEqual(2);
    expect(seq.steps.length).toBe(stab.chainWaves);
    expect(seq.steps.length).toBeGreaterThanOrEqual(2);

    let waveIndex = 1;
    let sumDeltas = 0;
    for (const step of seq.steps) {
      expect(step.waveIndex).toBe(waveIndex);
      waveIndex += 1;
      sumDeltas += step.scoreDelta;
      expect(step.clearedCellCount).toBe(step.clearedPositions.length);
      expect(step.baseScore).toBe(step.clearedCellCount * BASE_SCORE_PER_CELL);
    }
    expect(sumDeltas).toBe(seq.totalScore);
    expect(sumDeltas).toBe(stab.score);

    const replay = applySequenceWaveByWave(boardAfterSwap, seq, { refillSeed });
    expect(replay.board).toEqual(stab.board);
    expect(replay.totalScore).toBe(stab.score);
  });
});
