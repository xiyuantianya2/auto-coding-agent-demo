import { describe, expect, it } from "vitest";

import { isCellStateRuleConsistent } from "./cell-invariants";

describe("isCellStateRuleConsistent", () => {
  it("accepts empty cell", () => {
    expect(isCellStateRuleConsistent({})).toBe(true);
  });

  it("accepts valid given or value", () => {
    expect(isCellStateRuleConsistent({ given: 5 })).toBe(true);
    expect(isCellStateRuleConsistent({ value: 3 })).toBe(true);
  });

  it("rejects invalid given or value range", () => {
    expect(isCellStateRuleConsistent({ given: 0 as unknown as number })).toBe(false);
    expect(isCellStateRuleConsistent({ given: 10 as unknown as number })).toBe(false);
    expect(isCellStateRuleConsistent({ value: 0 as unknown as number })).toBe(false);
  });

  it("rejects notes outside 1–9", () => {
    expect(
      isCellStateRuleConsistent({ notes: new Set([1, 2, 10 as unknown as number]) }),
    ).toBe(false);
  });

  it("rejects notes when there is an effective digit (given priority)", () => {
    expect(
      isCellStateRuleConsistent({
        given: 4,
        notes: new Set([1, 2]),
      }),
    ).toBe(false);
  });

  it("rejects notes when there is player value only", () => {
    expect(
      isCellStateRuleConsistent({
        value: 7,
        notes: new Set([1]),
      }),
    ).toBe(false);
  });

  it("allows notes only when effective digit is empty", () => {
    expect(isCellStateRuleConsistent({ notes: new Set([1, 9]) })).toBe(true);
  });

  it("given wins over value for effective digit; notes still illegal if given present", () => {
    expect(
      isCellStateRuleConsistent({
        given: 2,
        value: 8,
        notes: new Set([3]),
      }),
    ).toBe(false);
  });

  it("empty notes set is consistent with a filled digit", () => {
    expect(isCellStateRuleConsistent({ value: 6, notes: new Set() })).toBe(true);
  });

  it("rejects invalid given regardless of notes", () => {
    expect(
      isCellStateRuleConsistent({
        given: 0 as unknown as number,
        notes: new Set([2]),
      }),
    ).toBe(false);
  });
});
