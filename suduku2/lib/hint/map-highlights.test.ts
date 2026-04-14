import { describe, expect, it } from "vitest";

import { GRID_SIZE } from "@/lib/core";

import {
  extractHighlightCandidateRefs,
  mapHighlightsToCells,
  normalizeSolveStepHighlights,
} from "./map-highlights";

function expectedRowCells(r: number): Array<{ r: number; c: number }> {
  return Array.from({ length: GRID_SIZE }, (_, c) => ({ r, c }));
}

function expectedColCells(c: number): Array<{ r: number; c: number }> {
  return Array.from({ length: GRID_SIZE }, (_, r) => ({ r, c }));
}

function expectedBoxCells(boxIndex: number): Array<{ r: number; c: number }> {
  const br = Math.floor(boxIndex / 3) * 3;
  const bc = (boxIndex % 3) * 3;
  const out: Array<{ r: number; c: number }> = [];
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      out.push({ r: br + dr, c: bc + dc });
    }
  }
  return out;
}

describe("mapHighlightsToCells", () => {
  it("expands kind unit row to 9 cells with correct coordinates", () => {
    const cells = mapHighlightsToCells([{ kind: "unit", ref: { type: "row", index: 4 } }]);
    expect(cells).toHaveLength(9);
    expect(cells).toEqual(expectedRowCells(4));
  });

  it("expands kind unit col to 9 cells with correct coordinates", () => {
    const cells = mapHighlightsToCells([{ kind: "unit", ref: { type: "col", index: 3 } }]);
    expect(cells).toHaveLength(9);
    expect(cells).toEqual(expectedColCells(3));
  });

  it("expands kind unit box to 9 cells with correct coordinates (box index 4)", () => {
    const cells = mapHighlightsToCells([{ kind: "unit", ref: { type: "box", index: 4 } }]);
    expect(cells).toHaveLength(9);
    expect(cells).toEqual(expectedBoxCells(4));
  });

  it("includes kind cell ref as a single coordinate", () => {
    const cells = mapHighlightsToCells([{ kind: "cell", ref: { r: 2, c: 5 } }]);
    expect(cells).toEqual([{ r: 2, c: 5 }]);
  });

  it("includes candidate highlight cell in merged cells", () => {
    const cells = mapHighlightsToCells([
      { kind: "candidate", ref: { r: 1, c: 2, digit: 7 } },
    ]);
    expect(cells).toEqual([{ r: 1, c: 2 }]);
  });

  it("dedupes and sorts row-major when mixing kinds", () => {
    const cells = mapHighlightsToCells([
      { kind: "cell", ref: { r: 1, c: 1 } },
      { kind: "cell", ref: { r: 1, c: 1 } },
      { kind: "candidate", ref: { r: 0, c: 0, digit: 9 } },
    ]);
    expect(cells).toEqual([
      { r: 0, c: 0 },
      { r: 1, c: 1 },
    ]);
  });

  it("skips invalid refs without throwing", () => {
    expect(
      mapHighlightsToCells([
        { kind: "cell", ref: { r: "x", c: 0 } },
        { kind: "unit", ref: { type: "row" } },
        { kind: "candidate", ref: { r: 0, c: 0 } },
        { kind: "cell", ref: { r: 0, c: 0 } },
      ]),
    ).toEqual([{ r: 0, c: 0 }]);
  });
});

describe("extractHighlightCandidateRefs", () => {
  it("parses candidate triplets", () => {
    expect(
      extractHighlightCandidateRefs([{ kind: "candidate", ref: { r: 4, c: 5, digit: 3 } }]),
    ).toEqual([{ r: 4, c: 5, digit: 3 }]);
  });
});

describe("normalizeSolveStepHighlights", () => {
  it("returns both merged cells and candidate list", () => {
    const n = normalizeSolveStepHighlights([
      { kind: "unit", ref: { type: "row", index: 0 } },
      { kind: "candidate", ref: { r: 0, c: 0, digit: 5 } },
    ]);
    expect(n.candidateHighlights).toEqual([{ r: 0, c: 0, digit: 5 }]);
    expect(n.cells.length).toBe(9);
    expect(n.cells[0]).toEqual({ r: 0, c: 0 });
  });
});
