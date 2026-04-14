/**
 * **唯一解出题与四档难度约束**（`puzzle-generator`）公开入口。
 *
 * 下游应自本文件引用（例如 `import { … } from "@/lib/generator"`），避免深路径耦合。
 *
 * ## 与 `module-plan.json` 对齐的契约
 *
 * - **难度档**：{@link DifficultyTier}（入门 / 普通 / 困难 / 专家）。
 * - **题目元数据**：{@link PuzzleSpec}（提示盘面、难度分、可选分数区间、解题轨迹上涉及的技巧 id）。
 * - **技巧标识**：{@link TechniqueId} 与 {@link TechniqueIds} 与 `@/lib/solver`、教学大纲一致；勿自行发明异名字符串。
 * - **函数**：{@link generatePuzzle}（完整盘 → 挖洞 → 唯一解 → tier 画像）、{@link verifyUniqueSolution}（完备回溯计数 + 早停）。
 *
 * `seed` 为可复现/可展示的题面标识（例如由 tier、尝试序号与 `rng` 派生的短摘要），**不要求密码学强度**。
 *
 * @module @/lib/generator
 */

import type { Grid9 } from "@/lib/core";
import type { TechniqueId } from "@/lib/solver";
import { TechniqueIds } from "@/lib/solver";

import type { DifficultyTier } from "./difficulty-tier";
import {
  DEFAULT_MAX_SOLVE_STEPS,
  derivePuzzleSpecFieldsForTier,
} from "./human-solve-trace";
import {
  DEFAULT_DIG_HOLES_TIMEOUT_MS,
  digHolesFromCompleteSolution,
} from "./dig-holes";
import { cloneGrid9 } from "./grid-game-state";
import { generateRandomCompleteGrid } from "./random-complete-grid";
import { verifyUniqueSolution } from "./unique-solution";

export type { DifficultyTier } from "./difficulty-tier";
export {
  TIER_PROFILES,
  getTierProfile,
  isTechniqueAllowedForTier,
  maxAllowedTechniqueWeight,
  scoreFitsTierProfile,
  type TierProfileDefinition,
} from "./tier-profiles";
export {
  DEFAULT_ANALYZE_BUDGET_MS,
  DEFAULT_MAX_SOLVE_STEPS,
  applyOneStep,
  classifyPuzzleMinimumTier,
  derivePuzzleDifficultyMetadata,
  derivePuzzleSpecDifficultyFields,
  derivePuzzleSpecFieldsForTier,
  gatherApplicableStepsFromCandidates,
  puzzleMatchesTierProfile,
  runHumanSolveTrace,
  type HumanSolveTraceResult,
  type RunHumanSolveTraceOptions,
} from "./human-solve-trace";

export {
  cloneGrid9,
  gameStateFromGivensGrid,
  gameStateFromSolvedGrid,
} from "./grid-game-state";
export {
  DEFAULT_DIG_HOLES_TIMEOUT_MS,
  digHolesFromCompleteSolution,
  type DigHolesFromCompleteSolutionOptions,
} from "./dig-holes";
export { generateRandomCompleteGrid } from "./random-complete-grid";
export { verifyUniqueSolution } from "./unique-solution";

/** 单次 {@link generatePuzzle} 默认总预算（毫秒）。 */
const DEFAULT_GENERATE_PUZZLE_TIMEOUT_MS = 5000;

/** 剩余时间低于此值则停止尝试，避免无意义碎片迭代。 */
const MIN_REMAINING_MS_TO_ATTEMPT = 100;

/** 防止异常超大 `timeoutMs` 导致极多长尝试。 */
const MAX_GENERATION_ATTEMPTS = 50_000;

// Re-export solver technique naming for callers that build or validate PuzzleSpec.requiredTechniques.
export type { TechniqueId };
export { TechniqueIds };

/**
 * 一局题目的对外元数据（与 `@/lib/core` 的 {@link Grid9} 对齐）。
 *
 * - **`seed`**：本题标识字符串，用于展示、日志或与存档对齐；由生成器写入（如 tier、尝试序号与 `rng` 摘要），非密码学随机数。
 * - **`givens`**：9×9 提示盘面，行优先；`0` 表示待填空格，`1`–`9` 为题目给定提示（与 `Grid9` 约定一致）。
 * - **`difficultyScore`**：与 `@/lib/solver` 的 `scoreDifficulty` 对齐的标量难度分，供选题与 UI 展示。
 * - **`scoreBand`**：可选的闭区间 `[low, high]`，表示该题目标难度分落点或允许展示区间；与 solver 打分结果中的 `band` 字段语义一致时使用。
 * - **`requiredTechniques`**：本题在约定求解路径下出现过的技巧 id 列表（或出题约束要求的技巧集合，由后续任务定义）；id 必须与 {@link TechniqueIds} / {@link TechniqueId} 命名一致。
 */
export interface PuzzleSpec {
  seed: string;
  givens: Grid9;
  difficultyScore: number;
  scoreBand?: [number, number];
  requiredTechniques: TechniqueId[];
}

/**
 * 生成一道符合难度档约束的题目。
 *
 * **重试策略**（性能优先，不追求最少提示或最难终盘）：
 * - 在总墙上时钟预算内循环：**随机完整有效解** → **随机顺序挖洞**（子预算）→ {@link verifyUniqueSolution} →
 *   {@link derivePuzzleSpecFieldsForTier}（与 `puzzleMatchesTierProfile` 等价的人类式 tier 校验 + 元数据）。
 * - 任一步失败则进入下一轮：每轮重新 `generateRandomCompleteGrid` 并换一批挖洞随机性（不在失败后长期固定同一终盘反复挖洞，以免卡死在难以命中 tier 的盘面族上）。
 * - 循环条件使用 `Date.now()` 与单调截止时间，避免死循环；尝试次数另设硬上限。
 *
 * @param options.tier - 目标难度档。
 * @param options.rng - 与 `[0, 1)` 一致的伪随机源，用于打乱与重试；需可复现时由调用方固定种子实现。
 * @param options.timeoutMs - 单次调用建议总耗时上限（毫秒）；未传时默认 5000ms。
 * @returns 符合档位的 {@link PuzzleSpec}；预算内无法命中则 `null`（不抛错）。
 */
export function generatePuzzle(options: {
  tier: DifficultyTier;
  rng: () => number;
  timeoutMs?: number;
}): PuzzleSpec | null {
  const { tier, rng } = options;
  const totalBudget =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? Math.max(0, options.timeoutMs)
      : DEFAULT_GENERATE_PUZZLE_TIMEOUT_MS;

  const globalDeadline = Date.now() + totalBudget;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const remaining = globalDeadline - Date.now();
    if (remaining < MIN_REMAINING_MS_TO_ATTEMPT) {
      return null;
    }

    // 时间切分：挖洞 + 唯一性验证通常快于 tier 人类式求解；为后者保留更大份额。
    const digBudget = Math.max(
      200,
      Math.min(DEFAULT_DIG_HOLES_TIMEOUT_MS, Math.floor(remaining * 0.35)),
    );
    const tierBudget = remaining - digBudget - 40;
    if (tierBudget < 250) {
      continue;
    }

    const solution = generateRandomCompleteGrid(rng);
    const givens = digHolesFromCompleteSolution({
      solution,
      rng,
      timeoutMs: digBudget,
    });
    if (!givens) {
      continue;
    }

    if (Date.now() >= globalDeadline) {
      return null;
    }
    if (!verifyUniqueSolution(givens)) {
      continue;
    }

    const tierOpts = {
      maxWallClockMs: Math.min(tierBudget, globalDeadline - Date.now() - 10),
      maxSteps: DEFAULT_MAX_SOLVE_STEPS,
    };
    if (tierOpts.maxWallClockMs < 80) {
      continue;
    }

    const specFields = derivePuzzleSpecFieldsForTier(givens, tier, rng, tierOpts);
    if (!specFields) {
      continue;
    }

    const seed = `sudoku2|${tier}|try${attempt}|r${Math.floor(rng() * 1_000_000_000)}`;

    return {
      seed,
      givens: cloneGrid9(givens),
      difficultyScore: specFields.difficultyScore,
      scoreBand: specFields.scoreBand,
      requiredTechniques: specFields.requiredTechniques,
    };
  }

  return null;
}

