/**
 * 通过 `@/lib/hint` 公共入口串联生成器题目、`GameState` 与多步提示链；验收 `TechniqueId`、`messageKey`
 * 与 {@link HINT_MESSAGE_KEYS} 一致且可逆解析（与 `lib/core`、`lib/solver`、`lib/generator` 的 integration 命名对齐）。
 */
import { describe, expect, it } from "vitest";

import { cloneGameState, createGameStateFromGivens, isLegalSetValue } from "@/lib/core";
import type { GameState, Grid9 } from "@/lib/core";
import { createMulberry32, generatePuzzle } from "@/lib/generator";
import { findTechniques, TECHNIQUE_IDS, type SolveStep } from "@/lib/solver";

import {
  HINT_MESSAGE_KEYS,
  getHintMessageKey,
  getNextHint,
  hintMessageKeyToTechniqueId,
  selectNextSolveStep,
  type HintResult,
  type TechniqueId,
} from "@/lib/hint";

/** 与 `lib/generator/integration.test.ts` 一致，保证 `generatePuzzle` 可复现。 */
const STABLE_MULBERRY = 0x9e3779b1;

const KNOWN_TECHNIQUE_IDS = new Set<string>(
  Object.keys(HINT_MESSAGE_KEYS) as TechniqueId[],
);

function assertHintMessageContract(hint: HintResult): void {
  expect(KNOWN_TECHNIQUE_IDS.has(hint.technique)).toBe(true);
  expect(hint.messageKey).toBeDefined();
  expect(getHintMessageKey(hint.technique)).toBe(hint.messageKey);
  expect(hintMessageKeyToTechniqueId(hint.messageKey!)).toBe(hint.technique);
}

function applySinglePlacementStep(state: GameState, step: SolveStep): GameState {
  const cellH = step.highlights.find((h) => h.kind === "cell");
  const candH = step.highlights.find((h) => h.kind === "candidate");
  if (!cellH || cellH.kind !== "cell" || !candH || candH.kind !== "candidate") {
    throw new Error("integration: expected cell + candidate highlights for placement step");
  }
  const { r, c } = cellH.ref;
  const { digit } = candH.ref;
  if (!isLegalSetValue(state, r, c, digit)) {
    throw new Error(`integration: illegal placement (${r},${c})=${digit}`);
  }
  const next = cloneGameState(state);
  next.cells[r][c] = { value: digit };
  return next;
}

/**
 * 从开局状态沿「与 {@link getNextHint} 相同的选步」前进：仅当下一步为裸单/隐单时写入数字；
 * 遇到消除类技巧则停止（该步的提示已在循环内校验）。
 */
function walkHintChainWhileSingles(initial: GameState, maxSteps: number): HintResult[] {
  const chain: HintResult[] = [];
  let state = initial;

  for (let k = 0; k < maxSteps; k++) {
    const hint = getNextHint(state);
    if (!hint) break;

    assertHintMessageContract(hint);
    chain.push(hint);

    const steps = findTechniques(state);
    const selected = selectNextSolveStep(steps);
    if (!selected) break;

    if (
      selected.technique !== TECHNIQUE_IDS.NAKED_SINGLE &&
      selected.technique !== TECHNIQUE_IDS.HIDDEN_SINGLE
    ) {
      break;
    }

    state = applySinglePlacementStep(state, selected);
  }

  return chain;
}

describe("hint-system barrel (@/lib/hint)", () => {
  it("exports TechniqueId + HintResult surface for downstream-only imports", () => {
    const technique: TechniqueId = TECHNIQUE_IDS.NAKED_SINGLE;
    expect(typeof technique).toBe("string");
    expect(KNOWN_TECHNIQUE_IDS.has(technique)).toBe(true);
  });

  it("fixed-seed easy puzzle: hint chain uses known techniques and resolvable messageKeys", () => {
    const spec = generatePuzzle({
      tier: "easy",
      rng: createMulberry32(STABLE_MULBERRY),
    });
    const state = createGameStateFromGivens(spec.givens);
    const chain = walkHintChainWhileSingles(state, 500);

    expect(chain.length).toBeGreaterThan(0);
    for (const hint of chain) {
      expect(hint.cells.length + (hint.highlightCandidates?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it("regression grid: chain ends on elimination technique with valid messageKey (naked-pair)", () => {
    const HODOKU_NAKED_PAIR_LINE =
      "7....9.3....1.5..64..26...9..2.83951..7........56.............31......6......4.1.";

    const g: Grid9 = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => {
        const ch = HODOKU_NAKED_PAIR_LINE[r * 9 + c]!;
        return ch === "." ? 0 : Number(ch);
      }),
    ) as Grid9;

    const state = createGameStateFromGivens(g);
    const chain = walkHintChainWhileSingles(state, 800);
    expect(chain.length).toBeGreaterThan(0);

    const last = chain[chain.length - 1]!;
    assertHintMessageContract(last);
    expect(last.technique).toBe(TECHNIQUE_IDS.NAKED_PAIR);
  });
});
