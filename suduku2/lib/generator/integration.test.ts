import { describe, expect, it } from "vitest";

import {
  cloneGameState,
  deserializeGameState,
  serializeGameState,
  type Grid9,
} from "@/lib/core";

import {
  type DifficultyTier,
  type PuzzleSpec,
  gameStateFromGivensGrid,
  generatePuzzle,
  verifyUniqueSolution,
} from "@/lib/generator";

/** 与 `[0, 1)` 一致的确定性 PRNG（固定 seed 便于稳定集成断言）。 */
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertPuzzleSpecJsonShape(parsed: unknown): asserts parsed is PuzzleSpec {
  expect(parsed).not.toBeNull();
  expect(typeof parsed).toBe("object");
  const o = parsed as Record<string, unknown>;
  expect(typeof o.seed).toBe("string");
  expect(Array.isArray(o.givens)).toBe(true);
  expect(o.givens).toHaveLength(9);
  for (const row of o.givens as Grid9) {
    expect(Array.isArray(row)).toBe(true);
    expect(row).toHaveLength(9);
  }
  expect(typeof o.difficultyScore).toBe("number");
  expect(Number.isFinite(o.difficultyScore)).toBe(true);
  expect(Array.isArray(o.requiredTechniques)).toBe(true);
  for (const id of o.requiredTechniques as string[]) {
    expect(typeof id).toBe("string");
  }
  if (o.scoreBand !== undefined) {
    expect(Array.isArray(o.scoreBand)).toBe(true);
    expect((o.scoreBand as number[]).length).toBe(2);
  }
}

describe("puzzle-generator public API integration (@/lib/generator)", () => {
  it("generatePuzzle → givens → verifyUniqueSolution is true (entry, default budget)", () => {
    const rng = mulberry32(900_013);
    const spec = generatePuzzle({ tier: "entry", rng });
    expect(spec).not.toBeNull();
    expect(verifyUniqueSolution(spec!.givens)).toBe(true);
  });

  it("PuzzleSpec: JSON round-trip preserves serializable field shape", () => {
    const rng = mulberry32(42_001);
    const spec = generatePuzzle({ tier: "normal", rng });
    expect(spec).not.toBeNull();

    const json = JSON.stringify(spec);
    expect(json.length).toBeGreaterThan(0);
    const parsed = JSON.parse(json) as unknown;
    assertPuzzleSpecJsonShape(parsed);
    expect(parsed.seed).toBe(spec!.seed);
    expect(parsed.difficultyScore).toBe(spec!.difficultyScore);
    expect(parsed.requiredTechniques).toEqual(spec!.requiredTechniques);
  });

  it("GameState bridge: givens from PuzzleSpec work with serialize/deserialize + clone without shared mutation", () => {
    const rng = mulberry32(55_010);
    const spec = generatePuzzle({ tier: "entry", rng });
    expect(spec).not.toBeNull();

    const s0 = gameStateFromGivensGrid(spec!.givens);
    const json = serializeGameState(s0);
    const s1 = deserializeGameState(json);
    const s2 = cloneGameState(s1);

    s2.grid[0]![0] = 0;
    s2.cells[0]![0] = {};

    expect(s1.grid[0]![0]).toBe(spec!.givens[0]![0]);
    expect(s0.grid[0]![0]).toBe(spec!.givens[0]![0]);
  });

  it("DifficultyTier: each tier is a valid `generatePuzzle` parameter (tight budget, no throw)", () => {
    (["entry", "normal", "hard", "expert"] as const satisfies readonly DifficultyTier[]).forEach(
      (tier, i) => {
        expect(() =>
          generatePuzzle({ tier, rng: mulberry32(700 + i), timeoutMs: 1 }),
        ).not.toThrow();
      },
    );
  });

  it(
    "expert tier: structure smoke only (null or valid spec, long budget)",
    { timeout: 120_000 },
    () => {
      const out = generatePuzzle({
        tier: "expert",
        rng: mulberry32(2026_04_14),
        timeoutMs: 90_000,
      });
      if (out === null) {
        return;
      }
      assertPuzzleSpecJsonShape(out);
      expect(verifyUniqueSolution(out.givens)).toBe(true);
    },
  );
});
