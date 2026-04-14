import type { GameState } from "@/lib/core";

import { computeCandidates } from "./candidates";
import { TechniqueIds } from "./technique-ids";
import type { CandidatesGrid } from "./types";
import type { SolveStep } from "./types";

/** @internal */
export type CellRef = { r: number; c: number };

/** @internal */
export type UnitRef = { type: "row" | "col" | "box"; index: number };

/** @internal */
export type CandidateElimination = CellRef & { digit: number };

function forEachBoxCell(b: number, fn: (r: number, c: number) => void): void {
  const br = Math.floor(b / 3) * 3;
  const bc = (b % 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      fn(br + dr, bc + dc);
    }
  }
}

function getCandidates(
  candidates: CandidatesGrid,
  r: number,
  c: number,
): Set<number> | null {
  return candidates[r][c];
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function eliminationKey(e: CandidateElimination): string {
  return `${e.r},${e.c},${e.digit}`;
}

function sortDigits(set: Set<number>): number[] {
  return [...set].sort((a, b) => a - b);
}

/** 以技巧 + 删减集合去重，避免同结论被不同高亮变体重复占满预算。 */
function stepDedupKey(step: SolveStep): string {
  const elim = (step.eliminations ?? []) as CandidateElimination[];
  const es = elim.map(eliminationKey).sort().join("|");
  return `${step.technique}#${es}`;
}

/** 整盘分析预算：墙上时钟 + 最大步数，避免异常输入下长时间阻塞。 */
const MAX_ELAPSED_MS = 2000;
const MAX_STEPS = 400;

type Budget = { deadline: number; stepCount: number };

function overBudget(b: Budget): boolean {
  return Date.now() > b.deadline || b.stepCount >= MAX_STEPS;
}

function pushStep(
  out: SolveStep[],
  seen: Set<string>,
  step: SolveStep,
  b: Budget,
): void {
  if (overBudget(b)) {
    return;
  }
  const k = stepDedupKey(step);
  if (seen.has(k)) {
    return;
  }
  seen.add(k);
  out.push(step);
  b.stepCount++;
}

function listUnitCells(
  unit: UnitRef,
): CellRef[] {
  const out: CellRef[] = [];
  if (unit.type === "row") {
    const r = unit.index;
    for (let c = 0; c < 9; c++) {
      out.push({ r, c });
    }
  } else if (unit.type === "col") {
    const c = unit.index;
    for (let r = 0; r < 9; r++) {
      out.push({ r, c });
    }
  } else {
    forEachBoxCell(unit.index, (r, c) => {
      out.push({ r, c });
    });
  }
  return out;
}

function collectNakedPairs(
  candidates: CandidatesGrid,
  out: SolveStep[],
  seen: Set<string>,
  b: Budget,
): void {
  const units: UnitRef[] = [];
  for (let i = 0; i < 9; i++) {
    units.push({ type: "row", index: i });
    units.push({ type: "col", index: i });
    units.push({ type: "box", index: i });
  }

  for (const unit of units) {
    if (overBudget(b)) {
      return;
    }
    const cells = listUnitCells(unit);
    const emptyCells = cells.filter(({ r, c }) => {
      const s = getCandidates(candidates, r, c);
      return s !== null && s.size >= 2;
    });
    for (let i = 0; i < emptyCells.length; i++) {
      for (let j = i + 1; j < emptyCells.length; j++) {
        const a = emptyCells[i]!;
        const cellB = emptyCells[j]!;
        const sa = getCandidates(candidates, a.r, a.c);
        const sb = getCandidates(candidates, cellB.r, cellB.c);
        if (!sa || !sb || sa.size !== 2 || sb.size !== 2) {
          continue;
        }
        if (sa.size !== sb.size) {
          continue;
        }
        const da = sortDigits(sa);
        const db = sortDigits(sb);
        if (da[0] !== db[0] || da[1] !== db[1]) {
          continue;
        }
        const [d1, d2] = da;
        const eliminations: CandidateElimination[] = [];
        for (const { r, c } of cells) {
          if ((r === a.r && c === a.c) || (r === cellB.r && c === cellB.c)) {
            continue;
          }
          const set = getCandidates(candidates, r, c);
          if (!set) {
            continue;
          }
          if (set.has(d1)) {
            eliminations.push({ r, c, digit: d1 });
          }
          if (set.has(d2)) {
            eliminations.push({ r, c, digit: d2 });
          }
        }
        if (eliminations.length === 0) {
          continue;
        }
        pushStep(
          out,
          seen,
          {
            technique: TechniqueIds.NakedPair,
            highlights: [
              { kind: "unit", ref: unit },
              { kind: "cell", ref: a },
              { kind: "cell", ref: cellB },
              { kind: "candidate", ref: { ...a, digit: d1 } },
              { kind: "candidate", ref: { ...cellB, digit: d2 } },
            ],
            eliminations,
            explanationKey: TechniqueIds.NakedPair,
          },
          b,
        );
      }
    }
  }
}

function collectHiddenPairs(
  candidates: CandidatesGrid,
  out: SolveStep[],
  seen: Set<string>,
  b: Budget,
): void {
  const units: UnitRef[] = [];
  for (let i = 0; i < 9; i++) {
    units.push({ type: "row", index: i });
    units.push({ type: "col", index: i });
    units.push({ type: "box", index: i });
  }

  for (const unit of units) {
    if (overBudget(b)) {
      return;
    }
    const cells = listUnitCells(unit);
    for (let d1 = 1; d1 <= 8; d1++) {
      for (let d2 = d1 + 1; d2 <= 9; d2++) {
        const pos1: CellRef[] = [];
        const pos2: CellRef[] = [];
        for (const { r, c } of cells) {
          const set = getCandidates(candidates, r, c);
          if (set?.has(d1)) {
            pos1.push({ r, c });
          }
          if (set?.has(d2)) {
            pos2.push({ r, c });
          }
        }
        if (pos1.length !== 2 || pos2.length !== 2) {
          continue;
        }
        const k1 = new Set(pos1.map((p) => cellKey(p.r, p.c)));
        const k2 = new Set(pos2.map((p) => cellKey(p.r, p.c)));
        if (k1.size !== 2 || k2.size !== 2) {
          continue;
        }
        let same = true;
        for (const x of k1) {
          if (!k2.has(x)) {
            same = false;
            break;
          }
        }
        if (!same || k1.size !== 2) {
          continue;
        }
        const pairCells = pos1;
        const eliminations: CandidateElimination[] = [];
        for (const { r, c } of pairCells) {
          const set = getCandidates(candidates, r, c);
          if (!set) {
            continue;
          }
          for (const d of set) {
            if (d !== d1 && d !== d2) {
              eliminations.push({ r, c, digit: d });
            }
          }
        }
        if (eliminations.length === 0) {
          continue;
        }
        const [p0, p1] = pairCells;
        pushStep(
          out,
          seen,
          {
            technique: TechniqueIds.HiddenPair,
            highlights: [
              { kind: "unit", ref: unit },
              { kind: "cell", ref: p0! },
              { kind: "cell", ref: p1! },
              { kind: "candidate", ref: { ...p0!, digit: d1 } },
              { kind: "candidate", ref: { ...p1!, digit: d2 } },
            ],
            eliminations,
            explanationKey: TechniqueIds.HiddenPair,
          },
          b,
        );
      }
    }
  }
}

function collectNakedTriples(
  candidates: CandidatesGrid,
  out: SolveStep[],
  seen: Set<string>,
  b: Budget,
): void {
  const units: UnitRef[] = [];
  for (let i = 0; i < 9; i++) {
    units.push({ type: "row", index: i });
    units.push({ type: "col", index: i });
    units.push({ type: "box", index: i });
  }

  for (const unit of units) {
    if (overBudget(b)) {
      return;
    }
    const cells = listUnitCells(unit);
    const emptyCells = cells.filter(({ r, c }) => {
      const s = getCandidates(candidates, r, c);
      return s !== null && s.size >= 2;
    });
    if (emptyCells.length < 3) {
      continue;
    }
    for (let i = 0; i < emptyCells.length; i++) {
      for (let j = i + 1; j < emptyCells.length; j++) {
        for (let k = j + 1; k < emptyCells.length; k++) {
          const a = emptyCells[i]!;
          const cellB = emptyCells[j]!;
          const c0 = emptyCells[k]!;
          const sa = getCandidates(candidates, a.r, a.c);
          const sb = getCandidates(candidates, cellB.r, cellB.c);
          const sc = getCandidates(candidates, c0.r, c0.c);
          if (!sa || !sb || !sc) {
            continue;
          }
          const union = new Set<number>([...sa, ...sb, ...sc]);
          if (union.size !== 3) {
            continue;
          }
          if (![...sa].every((d) => union.has(d))) {
            continue;
          }
          if (![...sb].every((d) => union.has(d))) {
            continue;
          }
          if (![...sc].every((d) => union.has(d))) {
            continue;
          }
          const digits = sortDigits(union);
          const eliminations: CandidateElimination[] = [];
          for (const { r, c } of cells) {
            if (
              (r === a.r && c === a.c) ||
              (r === cellB.r && c === cellB.c) ||
              (r === c0.r && c === c0.c)
            ) {
              continue;
            }
            const set = getCandidates(candidates, r, c);
            if (!set) {
              continue;
            }
            for (const d of digits) {
              if (set.has(d)) {
                eliminations.push({ r, c, digit: d });
              }
            }
          }
          if (eliminations.length === 0) {
            continue;
          }
          pushStep(
            out,
            seen,
            {
              technique: TechniqueIds.NakedTriple,
              highlights: [
                { kind: "unit", ref: unit },
                { kind: "cell", ref: a },
                { kind: "cell", ref: cellB },
                { kind: "cell", ref: c0 },
                {
                  kind: "candidate",
                  ref: { ...a, digit: digits[0]! },
                },
              ],
              eliminations,
              explanationKey: TechniqueIds.NakedTriple,
            },
            b,
          );
        }
      }
    }
  }
}

function collectHiddenTriples(
  candidates: CandidatesGrid,
  out: SolveStep[],
  seen: Set<string>,
  b: Budget,
): void {
  const units: UnitRef[] = [];
  for (let i = 0; i < 9; i++) {
    units.push({ type: "row", index: i });
    units.push({ type: "col", index: i });
    units.push({ type: "box", index: i });
  }

  for (const unit of units) {
    if (overBudget(b)) {
      return;
    }
    const cells = listUnitCells(unit);

    function positionsForDigit(d: number): CellRef[] {
      const pos: CellRef[] = [];
      for (const { r, c } of cells) {
        const set = getCandidates(candidates, r, c);
        if (set?.has(d)) {
          pos.push({ r, c });
        }
      }
      return pos;
    }

    for (let d1 = 1; d1 <= 7; d1++) {
      for (let d2 = d1 + 1; d2 <= 8; d2++) {
        for (let d3 = d2 + 1; d3 <= 9; d3++) {
          const p1 = positionsForDigit(d1);
          const p2 = positionsForDigit(d2);
          const p3 = positionsForDigit(d3);
          if (p1.length === 0 || p2.length === 0 || p3.length === 0) {
            continue;
          }
          const u = new Set<string>();
          for (const p of [...p1, ...p2, ...p3]) {
            u.add(cellKey(p.r, p.c));
          }
          if (u.size !== 3) {
            continue;
          }

          const tripleCells: CellRef[] = [...u].map((k) => {
            const [rs, cs] = k.split(",");
            return { r: Number(rs), c: Number(cs) };
          });

          const eliminations: CandidateElimination[] = [];
          for (const { r, c } of tripleCells) {
            const set = getCandidates(candidates, r, c);
            if (!set) {
              continue;
            }
            for (const digit of set) {
              if (digit !== d1 && digit !== d2 && digit !== d3) {
                eliminations.push({ r, c, digit });
              }
            }
          }
          if (eliminations.length === 0) {
            continue;
          }

          const t0 = tripleCells[0]!;
          pushStep(
            out,
            seen,
            {
              technique: TechniqueIds.HiddenTriple,
              highlights: [
                { kind: "unit", ref: unit },
                { kind: "cell", ref: tripleCells[0]! },
                { kind: "cell", ref: tripleCells[1]! },
                { kind: "cell", ref: tripleCells[2]! },
                {
                  kind: "candidate",
                  ref: { ...t0, digit: d1 },
                },
              ],
              eliminations,
              explanationKey: TechniqueIds.HiddenTriple,
            },
            b,
          );
        }
      }
    }
  }
}

/**
 * 在给定候选网格上扫描中阶技巧（不读 `GameState`）。
 * 供测试注入合成盘面，或在上层缓存候选后复用。
 */
export function findMidTierStepsFromCandidates(
  candidates: CandidatesGrid,
): SolveStep[] {
  const out: SolveStep[] = [];
  const seen = new Set<string>();
  const budget: Budget = {
    deadline: Date.now() + MAX_ELAPSED_MS,
    stepCount: 0,
  };

  collectNakedPairs(candidates, out, seen, budget);
  collectHiddenPairs(candidates, out, seen, budget);
  collectNakedTriples(candidates, out, seen, budget);
  collectHiddenTriples(candidates, out, seen, budget);

  return out;
}

/**
 * 中阶技巧：显性/隐性数对与三数组（在同行/列/宫内扫描，无回溯）。
 * 与 {@link TechniqueIds.Pointing} / {@link TechniqueIds.BoxLineReduction} 等低阶技巧区分。
 */
export function findMidTierApplicableSteps(state: GameState): SolveStep[] {
  return findMidTierStepsFromCandidates(computeCandidates(state));
}
