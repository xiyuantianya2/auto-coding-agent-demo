import { BOARD_SIZE, EMPTY_CELL } from "../core";
import type { Grid9 } from "../core";
import { collectEliminationsForDigit } from "./elimination-helpers";
import { cellsSeeEachOther } from "./peer-utils";
import { TECHNIQUE_IDS } from "./techniques";
import type { CandidatesGrid, SolveStep } from "./types";

function bivalueSorted(cand: Set<number>): [number, number] | null {
  if (cand.size !== 2) return null;
  const [a, b] = [...cand].sort((x, y) => x - y);
  return [a!, b!];
}

function buildXyWingHighlights(
  pivot: [number, number],
  wing1: [number, number],
  wing2: [number, number],
  z: number,
  cand: CandidatesGrid,
): SolveStep["highlights"] {
  const out: SolveStep["highlights"] = [];
  for (const [r, c] of [pivot, wing1, wing2]) {
    out.push({ kind: "cell", ref: { r, c } });
  }
  for (const [r, c] of [pivot, wing1, wing2]) {
    for (const d of [...cand[r][c]].sort((a, b) => a - b)) {
      out.push({ kind: "candidate", ref: { r, c, digit: d } });
    }
  }
  out.push({ kind: "candidate", ref: { r: wing1[0], c: wing1[1], digit: z } });
  out.push({ kind: "candidate", ref: { r: wing2[0], c: wing2[1], digit: z } });
  return out;
}

/**
 * XY-Wing：枢轴为双值 {x,y}；一钳制格与枢轴可见且为 {x,z}，另一为 {y,z}；两钳制彼此不可见。
 * 从同时可见两钳制格的空格删除 z。
 *
 * 搜索顺序稳定：枢轴行优先；含 x 的钳制行优先；含 y 的钳制行优先。
 */
export function xyWingFromCandidates(
  grid: Grid9,
  cand: CandidatesGrid,
  eliminationCand: CandidatesGrid = cand,
): SolveStep[] {
  const steps: SolveStep[] = [];

  for (let pr = 0; pr < BOARD_SIZE; pr++) {
    for (let pc = 0; pc < BOARD_SIZE; pc++) {
      if (grid[pr][pc] !== EMPTY_CELL) continue;
      const pivotPair = bivalueSorted(cand[pr][pc]);
      if (!pivotPair) continue;
      const [x, y] = pivotPair;

      type Wing = { r: number; c: number; z: number };
      const withX: Wing[] = [];
      const withY: Wing[] = [];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (r === pr && c === pc) continue;
          if (grid[r][c] !== EMPTY_CELL) continue;
          if (!cellsSeeEachOther(pr, pc, r, c)) continue;
          const pair = bivalueSorted(cand[r][c]);
          if (!pair) continue;
          const [d1, d2] = pair;
          if (d1 === x && d2 !== y) withX.push({ r, c, z: d2 });
          else if (d2 === x && d1 !== y) withX.push({ r, c, z: d1 });
          if (d1 === y && d2 !== x) withY.push({ r, c, z: d2 });
          else if (d2 === y && d1 !== x) withY.push({ r, c, z: d1 });
        }
      }

      for (const w1 of withX) {
        for (const w2 of withY) {
          if (w1.z !== w2.z) continue;
          if (cellsSeeEachOther(w1.r, w1.c, w2.r, w2.c)) continue;
          const z = w1.z;

          const elimCells: Array<[number, number]> = [];
          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              if (grid[r][c] !== EMPTY_CELL) continue;
              if ((r === pr && c === pc) || (r === w1.r && c === w1.c) || (r === w2.r && c === w2.c)) {
                continue;
              }
              if (cellsSeeEachOther(r, c, w1.r, w1.c) && cellsSeeEachOther(r, c, w2.r, w2.c)) {
                elimCells.push([r, c]);
              }
            }
          }

          const eliminations = collectEliminationsForDigit(elimCells, z, grid, eliminationCand);
          if (eliminations.length === 0) continue;

          const wing1: [number, number] = w1.r < w2.r || (w1.r === w2.r && w1.c <= w2.c) ? [w1.r, w1.c] : [w2.r, w2.c];
          const wing2: [number, number] = wing1[0] === w1.r && wing1[1] === w1.c ? [w2.r, w2.c] : [w1.r, w1.c];

          steps.push({
            technique: TECHNIQUE_IDS.XY_WING,
            highlights: buildXyWingHighlights([pr, pc], wing1, wing2, z, cand),
            eliminations,
          });
        }
      }
    }
  }

  return steps;
}
