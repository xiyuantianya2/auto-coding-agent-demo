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
 * - **函数**：{@link generatePuzzle}（占位）、{@link verifyUniqueSolution}（完备回溯计数 + 早停）。
 *
 * `seed` 为可复现/可展示的题面标识（例如由 tier、尝试序号与 `rng` 派生的短摘要），**不要求密码学强度**。
 *
 * @module @/lib/generator
 */

import type { Grid9 } from "@/lib/core";
import type { TechniqueId } from "@/lib/solver";
import { TechniqueIds } from "@/lib/solver";

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

// Re-export solver technique naming for callers that build or validate PuzzleSpec.requiredTechniques.
export type { TechniqueId };
export { TechniqueIds };

/**
 * 四档无尽难度（与产品文案「入门/普通/困难/专家」对应）。
 *
 * - **`entry`**：入门，技巧与分数约束最宽、最易完成。
 * - **`normal`**：普通。
 * - **`hard`**：困难。
 * - **`expert`**：专家，允许的技巧集合与目标分数区间最严。
 */
export type DifficultyTier = "entry" | "normal" | "hard" | "expert";

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
 * 生成一道符合难度档约束的题目（占位实现）。
 *
 * 后续任务将实现：完整盘 → 挖洞 → 唯一解校验 → 技巧/分数画像；并遵守 `timeoutMs` 等预算。
 *
 * @param options.tier - 目标难度档。
 * @param options.rng - 与 `[0, 1)` 一致的伪随机源，用于打乱与重试；需可复现时由调用方固定种子实现。
 * @param options.timeoutMs - 单次调用建议总耗时上限（毫秒）；未传时由实现使用合理默认（如 5000）。
 * @returns 占位阶段固定为 `null`；实现完成后为符合档位的 {@link PuzzleSpec}，预算内无解则 `null`。
 */
export function generatePuzzle(options: {
  tier: DifficultyTier;
  rng: () => number;
  timeoutMs?: number;
}): PuzzleSpec | null {
  void options;
  return null;
}

