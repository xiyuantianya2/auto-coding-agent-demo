import { describe, expect, it } from "vitest";

import {
  PUZZLE_SEED_HEX_DIGITS,
  createMulberry32,
  createRngFromSeed,
  derivePuzzleSeedString,
  isValidPuzzleSeedString,
} from "./rng";

describe("puzzle-generator rng (deterministic)", () => {
  it("validates canonical hex seed strings", () => {
    expect(isValidPuzzleSeedString("abcdef0123456789abcdef0123456789")).toBe(true);
    expect(isValidPuzzleSeedString("ABCDEF0123456789ABCDEF0123456789")).toBe(false);
    expect(isValidPuzzleSeedString("abc")).toBe(false);
    expect(PUZZLE_SEED_HEX_DIGITS).toBe(32);
  });

  it("createRngFromSeed: fixed seeds yield fixed sequences (Mulberry32)", () => {
    const rngA = createRngFromSeed("00000000000000000000000000000001");
    const expectedA = [
      0.8304477580823004, 0.1377779352478683, 0.15704975905828178, 0.514905811753124,
      0.7986693766433746, 0.0857504045125097, 0.6994461710564792, 0.3086197644006461,
      0.9151493001263589, 0.22162718465551734,
    ];
    expect(expectedA.map(() => rngA())).toEqual(expectedA);

    const rngB = createRngFromSeed("abcdef0123456789abcdef0123456789");
    const expectedB = [
      0.8276468075346202, 0.732723451917991, 0.0010228268802165985, 0.04904939909465611,
      0.052557770162820816, 0.3814650864806026, 0.08769686636514962, 0.2284401140641421,
      0.2531419082079083, 0.4233424325939268,
    ];
    expect(expectedB.map(() => rngB())).toEqual(expectedB);
  });

  it("createRngFromSeed: same seed replays the full stream identically", () => {
    const s = "0123456789abcdef0123456789abcdef";
    const take20 = (rng: () => number) => [...Array(20)].map(() => rng());
    expect(take20(createRngFromSeed(s))).toEqual(take20(createRngFromSeed(s)));
  });

  it("rejects invalid seed strings", () => {
    expect(() => createRngFromSeed("not-hex")).toThrow(TypeError);
    expect(() => createRngFromSeed("00")).toThrow(TypeError);
  });

  it("derivePuzzleSeedString encodes four uint32 draws as 32 hex chars", () => {
    let i = 0;
    const draws = [0.1, 0.2, 0.3, 0.4];
    const seed = derivePuzzleSeedString(() => draws[i++]);
    expect(seed).toBe("19999999333333334ccccccc66666666");
  });

  it("createMulberry32 exposes raw state for tests (deterministic)", () => {
    const r = createMulberry32(0x12345678);
    expect(r()).toBe(0.10615200875326991);
  });
});
