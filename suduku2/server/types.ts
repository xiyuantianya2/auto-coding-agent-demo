/**
 * 对外契约类型（与 `module-plan.json` 中 server-api 模块 interface 一致）。
 * `PuzzleSpec` 为持久化/API 边界形状；生成器模块可能返回额外字段，映射时裁剪至此形状。
 */
export type DifficultyTier = "entry" | "normal" | "hard" | "expert";

export type UserId = string;

export type PuzzleSpec = {
  seed: string;
  givens: number[][];
  difficultyScore: number;
};

export type EndlessGlobalState = Record<
  DifficultyTier,
  { maxPreparedLevel: number; puzzles: Record<number, PuzzleSpec> }
>;

export type UserProgress = {
  techniques: Record<string, { unlocked: boolean }>;
  practice: Record<string, { streak?: number; bestTimeMs?: number }>;
  endless: Record<DifficultyTier, { clearedLevel: number }>;
  /** `GameState`，见 `@/lib/core`；序列化由后续任务与 core 对齐 */
  draft?: unknown;
  settings?: Record<string, unknown>;
};

/**
 * `saveProgress` 的 patch 类型：所有字段可选；`endless` 允许只传部分档位，
 * `mergeEndless` 仅合并 patch 中出现的 tier。
 */
export type UserProgressPatch = Omit<Partial<UserProgress>, "endless"> & {
  endless?: Partial<UserProgress["endless"]>;
};
