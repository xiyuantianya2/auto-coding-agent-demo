/**
 * **局域网服务、账号与 JSON 持久化（`module-plan.json` → `server-api`）**
 *
 * 本目录为 **Node.js** 侧逻辑（`fs` / `http` / `crypto`），与 Next.js 页面代码解耦；后续任务在此实现
 * HTTP 与本地 JSON 存储，本文件仅提供**稳定类型与异步 API 骨架**。
 *
 * @packageDocumentation
 */

import type { DifficultyTier, PuzzleSpec, TechniqueId } from "@/lib/generator";

export type { DifficultyTier, PuzzleSpec, TechniqueId };

/** 服务端用户标识（不可猜测的随机 id 等），与 `module-plan` 一致。 */
export type UserId = string;

/**
 * 用户进度载荷（与 `module-plan.json` 中 server-api `interface` 一致）。
 *
 * **键空间约定（与客户端 / `content/curriculum` 对齐）：**
 *
 * - **`endless`**：键为无尽模式分段 id。**典型键**为四档难度 {@link DifficultyTier}
 *   (`'easy' | 'normal' | 'hard' | 'hell'`)，或产品定义的其它无尽线 id（同一字符串契约贯穿存档）。
 * - **`practice`**：键为专项练习 **`modeId`**，与 `getPracticeModeForTechnique(techniqueId).modeId`
 *   及技巧线一致（参见 `content/curriculum` 中 `PRACTICE_MODE_ID_PREFIX` 等约定）。
 * - **`tutorial`**：键为教学章节 **`ChapterId`**（`getCurriculumTree()` 节点的 `id` 字符串）。
 */
export type ProgressPayload = {
  endless: Record<
    string,
    {
      /** 当前关卡序号（产品约定非负整数，由客户端与服务器同一语义）。 */
      currentLevel: number;
      /** 关卡号 → 最短通关时间（毫秒）。键为关卡序号。 */
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
  /** 章节完成标记：`ChapterId` → 是否已完成。 */
  tutorial: Record<string, boolean>;
};

/** 骨架阶段：后续任务实现失败时仍可使用本消息或 `loadProgress` 的空占位。 */
export const SERVER_API_NOT_IMPLEMENTED =
  "server-api: not implemented (skeleton; replace in later server-api tasks)";

/** 与持久化缺省文件对应的空进度结构（供 `loadProgress` 占位与测试）。 */
export function createEmptyProgressPayload(): ProgressPayload {
  return {
    endless: {},
    practice: {},
    tutorial: {},
  };
}

/**
 * 注册新用户：写入用户名索引与凭证（后续任务）。
 *
 * @param username 显示名 / 登录名，唯一性由后续存储层保证。
 * @param passwordHash 客户端或服务端约定格式的密码摘要；本骨架不校验。
 * @returns 新用户的 {@link UserId}
 */
export async function registerUser(
  username: string,
  passwordHash: string,
): Promise<UserId> {
  void username;
  void passwordHash;
  throw new Error(SERVER_API_NOT_IMPLEMENTED);
}

/**
 * 登录并获取会话 token（后续任务：凭证校验与会话签发）。
 *
 * @param password 与注册时 `passwordHash` 约定一致的比对材料（产品语义由任务 3 固定）。
 */
export async function login(
  username: string,
  password: string,
): Promise<{ token: string }> {
  void username;
  void password;
  throw new Error(SERVER_API_NOT_IMPLEMENTED);
}

/**
 * 加载用户进度；无存档时应等价于 {@link createEmptyProgressPayload}（本骨架直接返回空对象）。
 */
export async function loadProgress(userId: UserId): Promise<ProgressPayload> {
  void userId;
  return createEmptyProgressPayload();
}

/** 保存用户进度（合并策略见后续任务）。 */
export async function saveProgress(
  userId: UserId,
  data: ProgressPayload,
): Promise<void> {
  void userId;
  void data;
  throw new Error(SERVER_API_NOT_IMPLEMENTED);
}

/**
 * 按难度档请求下一题（后续任务：调用 `generatePuzzle` 等）。
 *
 * @param tier 难度分档，与 `@/lib/generator` 一致。
 */
export async function requestNextPuzzle(
  userId: UserId,
  tier: DifficultyTier,
): Promise<PuzzleSpec> {
  void userId;
  void tier;
  throw new Error(SERVER_API_NOT_IMPLEMENTED);
}
