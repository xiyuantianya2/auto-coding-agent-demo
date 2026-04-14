/**
 * 用户进度载荷（与 `module-plan.json` 中 server-api `interface` 一致）。
 *
 * **键空间约定（与客户端 / `content/curriculum` 对齐）：**
 *
 * - **`endless`**：键为无尽模式分段 id。**典型键**为四档难度（与 `@/lib/generator` 的 `DifficultyTier` 一致：
 *   `'easy' | 'normal' | 'hard' | 'hell'`），或产品定义的其它无尽线 id（同一字符串契约贯穿存档）。
 * - **`practice`**：键为专项练习 **`modeId`**，与 `getPracticeModeForTechnique(techniqueId).modeId`
 *   及技巧线一致（参见 `content/curriculum` 中 `PRACTICE_MODE_ID_PREFIX` 等约定）。
 * - **`tutorial`**：键为教学章节 **`ChapterId`**（`getCurriculumTree()` 节点的 `id` 字符串）。
 */
export type ProgressPayload = {
  endless: Record<
    string,
    {
      currentLevel: number;
      bestTimesMs: Record<number, number>;
    }
  >;
  practice: Record<
    string,
    {
      unlocked: boolean;
      streak: number;
      bestTimeMs?: number;
    }
  >;
  tutorial: Record<string, boolean>;
};

/** 与持久化缺省文件对应的空进度结构（供 `loadProgress` 占位与测试）。 */
export function createEmptyProgressPayload(): ProgressPayload {
  return {
    endless: {},
    practice: {},
    tutorial: {},
  };
}
