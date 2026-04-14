/**
 * {@link generatePuzzle} 的实现：终盘 → 挖空 → 唯一解校验 → 用 solver 做单次「当前层」技巧枚举与打分 → 按档位配置验收或重试。
 *
 * ## 解题路径与 `requiredTechniques` / `difficultyScore`
 *
 * - **`easy` 档：**用「仅裸单 / 隐单」链式填数模拟完整解题（每步从 {@link findTechniques} 取一个裸单或隐单并
 *   写入盘面，再重新计算），收集步骤序列；{@link scoreDifficulty}`(initialState, steps)` 与 `requiredTechniques`
 *   均基于该序列。挖空时使用 {@link DIFFICULTY_TIER_CONFIG}.easy 的 `givensCount.max` 作为删格下界以保留更多提示。
 *   累加难度分可能高于配置表中的 `easy.difficultyScoreRange` 上界，故**不再**用该区间卡分，仅卡技巧上界（裸单/隐单）。
 * - **其它档：**对初始盘面调用一次 `computeCandidates` + `findTechniques`（与 `lib/solver/integration.test.ts`
 *   的快照用法一致），`scoreDifficulty(initialState, steps)`，`requiredTechniques` 为步骤中去重排序后的技巧 id。
 *
 * ## 失败语义
 *
 * 若在 {@link GENERATE_PUZZLE_MAX_ATTEMPTS} 次「完整生成（新终盘 + 挖空）」后仍无法满足档位**技巧上界**与（`normal` 及以上）**分数区间**，抛出带说明的 {@link Error}。
 */

import type { DifficultyTier, GameState } from "../core";
import { cloneGameState, createGameStateFromGivens, isLegalSetValue, isWinningState } from "../core";
import {
  CandidatesComputationError,
  TECHNIQUE_IDS,
  computeCandidates,
  findTechniques,
  scoreDifficulty,
  TECHNIQUE_RESOLUTION_ORDER,
  type SolveStep,
} from "../solver";

import { DIFFICULTY_TIER_CONFIG } from "./difficulty-tier-config";
import { generateCompleteGrid } from "./complete-grid";
import { digPuzzleFromSolution } from "./dig-puzzle";
import type { PuzzleSpec } from "./puzzle-spec";
import { createRngFromSeed, derivePuzzleSeedString } from "./rng";
import { verifyUniqueSolution } from "./verify-unique-solution";

/** 单次 {@link generatePuzzle} 调用中，默认最多尝试的「终盘 + 挖空 + 校验」轮数（可用环境变量覆盖，见 {@link readGeneratePuzzleMaxAttempts}）。 */
export const GENERATE_PUZZLE_MAX_ATTEMPTS = 512;

function readGeneratePuzzleMaxAttempts(): number {
  if (typeof process === "undefined") return GENERATE_PUZZLE_MAX_ATTEMPTS;
  const raw = process.env.GENERATE_PUZZLE_MAX_ATTEMPTS;
  if (raw === undefined || raw === "") return GENERATE_PUZZLE_MAX_ATTEMPTS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return GENERATE_PUZZLE_MAX_ATTEMPTS;
  return Math.min(Math.floor(n), 50_000);
}

const SINGLES_CHAIN_MAX_STEPS = 600;

function applyTechniqueSinglePlacement(state: GameState, step: SolveStep): GameState {
  const cand = step.highlights.find((h) => h.kind === "candidate")?.ref as
    | { r: number; c: number; digit: number }
    | undefined;
  if (!cand) {
    throw new Error("puzzle-generator: expected a candidate highlight on single-placement step");
  }
  const { r, c, digit } = cand;
  if (!isLegalSetValue(state, r, c, digit)) {
    throw new Error(`puzzle-generator: illegal placement (${r},${c})=${digit}`);
  }
  const next = cloneGameState(state);
  next.cells[r]![c] = { value: digit };
  return next;
}

/**
 * 仅使用「裸单 / 隐单」逐步填数直至终局或无法继续（用于 `easy` 档：与 `findTechniques` 单次快照中
 * 并行列出全部裸单导致的分数爆炸区分开）。
 */
/** 导出供单元测试与 `easy` 档元数据对齐校验。 */
export function collectSinglesOnlySolvePath(initial: GameState): { steps: SolveStep[]; solved: boolean } {
  const path: SolveStep[] = [];
  let state = cloneGameState(initial);

  for (let k = 0; k < SINGLES_CHAIN_MAX_STEPS; k++) {
    if (isWinningState(state)) return { steps: path, solved: true };

    let layer: SolveStep[];
    try {
      computeCandidates(state);
      layer = findTechniques(state);
    } catch {
      return { steps: path, solved: false };
    }

    const ns = layer.find(
      (s) => s.technique === TECHNIQUE_IDS.NAKED_SINGLE && !s.eliminations?.length,
    );
    const hs = layer.find(
      (s) => s.technique === TECHNIQUE_IDS.HIDDEN_SINGLE && !s.eliminations?.length,
    );
    const step = ns ?? hs;
    if (!step) return { steps: path, solved: false };

    path.push(step);
    try {
      state = applyTechniqueSinglePlacement(state, step);
    } catch {
      return { steps: path, solved: false };
    }
  }

  return { steps: path, solved: isWinningState(state) };
}

function scoreInTierRange(tier: DifficultyTier, score: number): boolean {
  const { min, max } = DIFFICULTY_TIER_CONFIG[tier].difficultyScoreRange;
  return score >= min && score <= max;
}

function techniquesAllowedForTier(tier: DifficultyTier, steps: SolveStep[]): boolean {
  const maxIdx = DIFFICULTY_TIER_CONFIG[tier].maxTechniqueResolutionOrderIndex;
  for (const s of steps) {
    const i = TECHNIQUE_RESOLUTION_ORDER.indexOf(s.technique);
    if (i === -1 || i > maxIdx) return false;
  }
  return true;
}

/**
 * 按目标难度档生成唯一解题目与元数据。
 *
 * **随机与 `seed`：**先对注入的 `rng` 调用 {@link derivePuzzleSeedString}（恰好 4 次 `rng()`），得到 canonical
 * `PuzzleSpec.seed`；后续所有终盘 / 挖空均使用 {@link createRngFromSeed}`(seed)`，保证仅凭 `seed` 即可复现整局。
 *
 * **验收：**对挖空后的 `givens` 构造 `GameState`，调用 `computeCandidates` 与 `findTechniques`；若盘面未解但无可用技巧、
 * 或分数 / 技巧层级不满足 {@link DIFFICULTY_TIER_CONFIG}，则用**同一** `createRngFromSeed(seed)` 流继续尝试下一局终盘
 * （消耗更多随机数，等价于换终盘 / 换挖空顺序）。
 */
export function generatePuzzle(options: { tier: DifficultyTier; rng: () => number }): PuzzleSpec {
  const { tier } = options;
  const seed = derivePuzzleSeedString(options.rng);
  const genRng = createRngFromSeed(seed);
  const maxAttempts = readGeneratePuzzleMaxAttempts();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const completedGrid = generateCompleteGrid(genRng);
    const givens = digPuzzleFromSolution({
      completedGrid,
      tier,
      rng: genRng,
      /** `easy` 档需「裸单/隐单」链可解；保留更多提示（见 {@link DIFFICULTY_TIER_CONFIG}.easy.givensCount.max）。 */
      minGivensStopOverride:
        tier === "easy" ? DIFFICULTY_TIER_CONFIG.easy.givensCount.max : undefined,
      /** 默认 50k 唯一性检查在 Vitest/交互式开发中过慢；仍保证唯一解（见 dig-puzzle 提前返回语义）。 */
      maxUniqueChecks: 12_000,
      maxElapsedMs: 25_000,
    });

    if (!verifyUniqueSolution(givens)) continue;

    const state = createGameStateFromGivens(givens);
    let steps: SolveStep[];
    if (tier === "easy") {
      const chain = collectSinglesOnlySolvePath(state);
      if (!chain.solved) continue;
      steps = chain.steps;
    } else {
      let layer: SolveStep[];
      try {
        computeCandidates(state);
        layer = findTechniques(state);
      } catch (e) {
        if (e instanceof CandidatesComputationError) continue;
        throw e;
      }
      if (!isWinningState(state) && layer.length === 0) continue;
      steps = layer;
    }

    const difficultyScore = scoreDifficulty(state, steps);
    /** `easy` 使用链式裸单/隐单累加分，可能超出 {@link DIFFICULTY_TIER_CONFIG}.easy 的 legacy 快照区间；仍以技巧上界验收。 */
    if (tier !== "easy" && !scoreInTierRange(tier, difficultyScore)) continue;
    if (!techniquesAllowedForTier(tier, steps)) continue;

    const requiredTechniques = [...new Set(steps.map((s) => s.technique))].sort((a, b) =>
      a.localeCompare(b),
    );
    return { seed, givens, difficultyScore, requiredTechniques };
  }

  throw new Error(
    `puzzle-generator: generatePuzzle could not satisfy tier "${tier}" within ${maxAttempts} attempts (set GENERATE_PUZZLE_MAX_ATTEMPTS or adjust DIFFICULTY_TIER_CONFIG).`,
  );
}
