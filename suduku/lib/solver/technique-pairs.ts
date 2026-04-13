import {
  BOARD_SIZE,
  BOX_SIZE,
  DIGIT_MAX,
  DIGIT_MIN,
  EMPTY_CELL,
  boxIndexFromCell,
} from "../core";
import type { Grid9 } from "../core";
import { TECHNIQUE_IDS } from "./techniques";
import type { CandidateElimination, CandidatesGrid, SolveStep, SolveStepHighlight } from "./types";

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function parseKey(k: string): [number, number] {
  const [r, c] = k.split(",").map(Number);
  return [r!, c!];
}

function iterRowCells(r: number): Array<[number, number]> {
  return Array.from({ length: BOARD_SIZE }, (_, c) => [r, c] as [number, number]);
}

function iterColCells(c: number): Array<[number, number]> {
  return Array.from({ length: BOARD_SIZE }, (_, r) => [r, c] as [number, number]);
}

function boxTopLeft(boxIndex: number): { br: number; bc: number } {
  const row = Math.floor(boxIndex / BOX_SIZE);
  const col = boxIndex % BOX_SIZE;
  return { br: row * BOX_SIZE, bc: col * BOX_SIZE };
}

function iterBoxCells(boxIndex: number): Array<[number, number]> {
  const { br, bc } = boxTopLeft(boxIndex);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < BOX_SIZE; i++) {
    for (let j = 0; j < BOX_SIZE; j++) {
      out.push([br + i, bc + j]);
    }
  }
  return out;
}

function cellsForUnit(
  unit: "row" | "col" | "box",
  index: number,
): Array<[number, number]> {
  if (unit === "row") return iterRowCells(index);
  if (unit === "col") return iterColCells(index);
  return iterBoxCells(index);
}

function emptyCellsInUnit(
  grid: Grid9,
  unit: "row" | "col" | "box",
  index: number,
): Array<[number, number]> {
  return cellsForUnit(unit, index).filter(([r, c]) => grid[r][c] === EMPTY_CELL);
}

function sortedPairKeys(a: [number, number], b: [number, number]): [[number, number], [number, number]] {
  const [r1, c1] = a;
  const [r2, c2] = b;
  if (r1 !== r2) return r1 < r2 ? [a, b] : [b, a];
  return c1 <= c2 ? [a, b] : [b, a];
}

function buildNakedPairStep(
  unit: "row" | "col" | "box",
  unitIndex: number,
  p1: [number, number],
  p2: [number, number],
  d1: number,
  d2: number,
  grid: Grid9,
  cand: CandidatesGrid,
): SolveStep | null {
  const eliminations: CandidateElimination[] = [];
  const perCell = new Map<string, Set<number>>();

  for (const [r, c] of cellsForUnit(unit, unitIndex)) {
    if ((r === p1[0] && c === p1[1]) || (r === p2[0] && c === p2[1])) continue;
    if (grid[r][c] !== EMPTY_CELL) continue;
    const rm: number[] = [];
    if (cand[r][c].has(d1)) rm.push(d1);
    if (cand[r][c].has(d2)) rm.push(d2);
    if (rm.length === 0) continue;
    const key = cellKey(r, c);
    let set = perCell.get(key);
    if (!set) {
      set = new Set<number>();
      perCell.set(key, set);
    }
    for (const x of rm) set.add(x);
  }

  for (const [key, digits] of perCell) {
    const [r, c] = parseKey(key);
    eliminations.push({ r, c, digits: [...digits].sort((a, b) => a - b) });
  }
  eliminations.sort((a, b) => a.r - b.r || a.c - b.c);

  if (eliminations.length === 0) return null;

  const box1 = boxIndexFromCell(p1[0], p1[1]);
  const box2 = boxIndexFromCell(p2[0], p2[1]);
  const highlights: SolveStepHighlight[] = [
    { kind: "unit", ref: { unit, index: unitIndex } },
    { kind: "cell", ref: { r: p1[0], c: p1[1] } },
    { kind: "cell", ref: { r: p2[0], c: p2[1] } },
    { kind: "unit", ref: { unit: "box", index: box1 } },
  ];
  if (box2 !== box1) {
    highlights.push({ kind: "unit", ref: { unit: "box", index: box2 } });
  }
  highlights.push(
    { kind: "candidate", ref: { r: p1[0], c: p1[1], digit: d1 } },
    { kind: "candidate", ref: { r: p1[0], c: p1[1], digit: d2 } },
    { kind: "candidate", ref: { r: p2[0], c: p2[1], digit: d1 } },
    { kind: "candidate", ref: { r: p2[0], c: p2[1], digit: d2 } },
  );
  return {
    technique: TECHNIQUE_IDS.NAKED_PAIR,
    highlights,
    eliminations,
  };
}

/**
 * 同一行 / 列 / 宫内裸数对：两空格候选集相同且大小为 2，从该单位其它空格中删去这两个数字。
 * 顺序：单位类型 row → col → box；单位索引升序；格对按 (r,c) 字典序。
 */
export function nakedPairsFromCandidates(grid: Grid9, cand: CandidatesGrid): SolveStep[] {
  const steps: SolveStep[] = [];

  const scanUnit = (unit: "row" | "col" | "box", unitIndex: number): void => {
    const cells = emptyCellsInUnit(grid, unit, unitIndex);
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const [r1, c1] = cells[i]!;
        const [r2, c2] = cells[j]!;
        const s1 = cand[r1][c1];
        const s2 = cand[r2][c2];
        if (s1.size !== 2 || s2.size !== 2) continue;
        const a1 = [...s1].sort((a, b) => a - b);
        const a2 = [...s2].sort((a, b) => a - b);
        if (a1[0] !== a2[0] || a1[1] !== a2[1]) continue;
        const d1 = a1[0]!;
        const d2 = a1[1]!;
        const [p1, p2] = sortedPairKeys([r1, c1], [r2, c2]);
        const step = buildNakedPairStep(unit, unitIndex, p1, p2, d1, d2, grid, cand);
        if (step) steps.push(step);
      }
    }
  };

  for (let r = 0; r < BOARD_SIZE; r++) scanUnit("row", r);
  for (let c = 0; c < BOARD_SIZE; c++) scanUnit("col", c);
  for (let b = 0; b < BOARD_SIZE; b++) scanUnit("box", b);

  return steps;
}

function digitPositionsInUnit(
  unit: "row" | "col" | "box",
  index: number,
  d: number,
  grid: Grid9,
  cand: CandidatesGrid,
): Set<string> {
  const out = new Set<string>();
  for (const [r, c] of cellsForUnit(unit, index)) {
    if (grid[r][c] !== EMPTY_CELL) continue;
    if (cand[r][c].has(d)) out.add(cellKey(r, c));
  }
  return out;
}

function buildHiddenPairStep(
  unit: "row" | "col" | "box",
  unitIndex: number,
  ka: string,
  kb: string,
  d1: number,
  d2: number,
  cand: CandidatesGrid,
): SolveStep | null {
  const [ar, ac] = parseKey(ka);
  const [br, bc] = parseKey(kb);
  const eliminations: CandidateElimination[] = [];

  for (const [r, c] of [parseKey(ka), parseKey(kb)] as Array<[number, number]>) {
    const rm: number[] = [];
    for (const n of cand[r][c]) {
      if (n !== d1 && n !== d2) rm.push(n);
    }
    if (rm.length) eliminations.push({ r, c, digits: rm.sort((a, b) => a - b) });
  }
  eliminations.sort((a, b) => a.r - b.r || a.c - b.c);
  if (eliminations.length === 0) return null;

  const boxA = boxIndexFromCell(ar, ac);
  const boxB = boxIndexFromCell(br, bc);
  const highlights: SolveStepHighlight[] = [
    { kind: "unit", ref: { unit, index: unitIndex } },
    { kind: "cell", ref: { r: ar, c: ac } },
    { kind: "cell", ref: { r: br, c: bc } },
    { kind: "unit", ref: { unit: "box", index: boxA } },
  ];
  if (boxB !== boxA) {
    highlights.push({ kind: "unit", ref: { unit: "box", index: boxB } });
  }
  highlights.push(
    { kind: "candidate", ref: { r: ar, c: ac, digit: d1 } },
    { kind: "candidate", ref: { r: ar, c: ac, digit: d2 } },
    { kind: "candidate", ref: { r: br, c: bc, digit: d1 } },
    { kind: "candidate", ref: { r: br, c: bc, digit: d2 } },
  );
  return {
    technique: TECHNIQUE_IDS.HIDDEN_PAIR,
    highlights,
    eliminations,
  };
}

/**
 * 隐数对：某单位内两数字的候选仅出现在同一对空格（并集恰为这两格），从这两格删去其它候选。
 * 顺序：单位 row → col → box；单位索引；格对字典序；数字对 (d1,d2) 升序。
 */
export function hiddenPairsFromCandidates(grid: Grid9, cand: CandidatesGrid): SolveStep[] {
  const steps: SolveStep[] = [];

  const scanUnit = (unit: "row" | "col" | "box", unitIndex: number): void => {
    const empty = emptyCellsInUnit(grid, unit, unitIndex);
    for (let i = 0; i < empty.length; i++) {
      for (let j = i + 1; j < empty.length; j++) {
        const A = empty[i]!;
        const B = empty[j]!;
        const [p1, p2] = sortedPairKeys(A, B);
        const k1 = cellKey(p1[0], p1[1]);
        const k2 = cellKey(p2[0], p2[1]);
        const pairKeys = new Set<string>([k1, k2]);

        for (let d1 = DIGIT_MIN; d1 <= DIGIT_MAX; d1++) {
          for (let d2 = d1 + 1; d2 <= DIGIT_MAX; d2++) {
            const P1 = digitPositionsInUnit(unit, unitIndex, d1, grid, cand);
            const P2 = digitPositionsInUnit(unit, unitIndex, d2, grid, cand);
            if (P1.size === 0 || P2.size === 0) continue;
            const union = new Set<string>([...P1, ...P2]);
            if (union.size !== 2) continue;
            if (!union.has(k1) || !union.has(k2)) continue;
            let subsetOk = true;
            for (const k of P1) {
              if (!pairKeys.has(k)) subsetOk = false;
            }
            for (const k of P2) {
              if (!pairKeys.has(k)) subsetOk = false;
            }
            if (!subsetOk) continue;

            const step = buildHiddenPairStep(unit, unitIndex, k1, k2, d1, d2, cand);
            if (step) steps.push(step);
          }
        }
      }
    }
  };

  for (let r = 0; r < BOARD_SIZE; r++) scanUnit("row", r);
  for (let c = 0; c < BOARD_SIZE; c++) scanUnit("col", c);
  for (let b = 0; b < BOARD_SIZE; b++) scanUnit("box", b);

  return steps;
}
