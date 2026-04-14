import crypto from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import * as generator from "@/lib/generator";
import { generatePuzzle } from "@/lib/generator";

import {
  createEntropyRngForPuzzleRequest,
  requestNextPuzzle,
} from "./request-next-puzzle";

describe("requestNextPuzzle", () => {
  it("returns the same PuzzleSpec as generatePuzzle with the matching entropy rng (fixed UUID)", async () => {
    const fixed = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(fixed);
    const userId = "user-parity";
    const tier = "easy";
    const expected = generatePuzzle({
      tier,
      rng: createEntropyRngForPuzzleRequest(userId, tier, fixed),
    });
    await expect(requestNextPuzzle(userId, tier)).resolves.toEqual(expected);
    vi.restoreAllMocks();
  });

  it("normal tier: matches direct generatePuzzle under fixed UUID", async () => {
    const fixed = "bbbbbbbb-cccc-4ddd-eeee-ffffffffffff";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(fixed);
    const userId = "user-parity-normal";
    const tier = "normal";
    const expected = generatePuzzle({
      tier,
      rng: createEntropyRngForPuzzleRequest(userId, tier, fixed),
    });
    await expect(requestNextPuzzle(userId, tier)).resolves.toEqual(expected);
    vi.restoreAllMocks();
  });

  it("smoke hard: delegates to generatePuzzle with tier hard", async () => {
    const fast = generatePuzzle({
      tier: "normal",
      rng: generator.createMulberry32(0xabcdef01),
    });
    const spy = vi.spyOn(generator, "generatePuzzle").mockReturnValue(fast);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("dddddddd-eeee-4fff-8888-999999999999");
    await expect(requestNextPuzzle("hard-delegate", "hard")).resolves.toEqual(fast);
    expect(spy.mock.calls[0]![0].tier).toBe("hard");
    vi.restoreAllMocks();
  });

  it("smoke hell: delegates to generatePuzzle with tier hell (full hell run can exceed CI budgets)", async () => {
    const fast = generatePuzzle({
      tier: "easy",
      rng: generator.createMulberry32(0x1234abcd),
    });
    const spy = vi.spyOn(generator, "generatePuzzle").mockReturnValue(fast);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("eeeeeeee-ffff-4aaa-bbbb-cccccccccccc");
    await expect(requestNextPuzzle("hell-delegate", "hell")).resolves.toEqual(fast);
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0]![0]!;
    expect(arg.tier).toBe("hell");
    expect(typeof arg.rng).toBe("function");
    const r = arg.rng();
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
    vi.restoreAllMocks();
  });

  it("uses a new UUID per call so successive puzzles differ (same user/tier)", async () => {
    const specs = await Promise.all([
      requestNextPuzzle("u1", "easy"),
      requestNextPuzzle("u1", "easy"),
    ]);
    expect(specs[0]!.seed).not.toBe(specs[1]!.seed);
  });
});
