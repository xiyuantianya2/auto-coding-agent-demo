/**
 * **局域网服务、账号与 JSON 持久化（`module-plan.json` → `server-api`）**
 *
 * 本目录为 **Node.js** 侧逻辑（`fs` / `http` / `crypto`），与 Next.js 页面代码解耦；已实现本地 JSON 存储层与注册/登录（任务 2–3），后续任务补充会话校验、进度合并与 HTTP。
 *
 * @packageDocumentation
 */

import type { DifficultyTier, PuzzleSpec, TechniqueId } from "@/lib/generator";

import {
  createEmptyProgressPayload,
  type ProgressPayload,
} from "./progress-types";

export type { DifficultyTier, PuzzleSpec, TechniqueId };

/** 服务端用户标识（不可猜测的随机 id 等），与 `module-plan` 一致。 */
export type UserId = string;

export type { ProgressPayload };
export { createEmptyProgressPayload };

/** 骨架阶段：后续任务实现失败时仍可使用本消息或 `loadProgress` 的空占位。 */
export const SERVER_API_NOT_IMPLEMENTED =
  "server-api: not implemented (skeleton; replace in later server-api tasks)";

/** 本地数据根目录解析、用户路径与 `progress.json` 原子读写（任务 2；供后续 `loadProgress` / `saveProgress` 接线）。 */
export {
  DEFAULT_DATA_DIR_RELATIVE,
  SUDUKU_DATA_DIR_ENV,
  ensureDirExists,
  resolveSudukuDataDir,
} from "./storage/data-root";
export {
  InvalidUserIdError,
  USER_FILES,
  USERS_SEGMENT,
  getUserDir,
  getUserProgressPath,
} from "./storage/paths";
export {
  ProgressFileParseError,
  readUserProgressFile,
  writeUserProgressFileAtomic,
} from "./storage/progress-file";
export {
  ProgressPayloadValidationError,
  parseProgressPayload,
} from "./storage/progress-payload";

/**
 * 注册与登录（任务 3）。`passwordHash` / `login.password` 的产品语义见 {@link "./register-login"} 文件头注释。
 *
 * @param username 登录名；经 `trim` 后非空；唯一性由 `username-index.json` 保证。
 * @param passwordHash 与 `module-plan` 一致：服务端**原样**持久化，供登录时与 `password` 常量时间比对。
 */
export { registerUser } from "./register-login";

/**
 * @param password 与注册时写入 `credentials.json` 的 `passwordHash` **同一约定**下的比对串（字段名不同，字节序列应一致）。
 * @returns 成功时返回 HMAC 签名的会话 `token`；后续 HTTP 侧使用 `Authorization: Bearer <token>`，并用 {@link validateToken} 校验。
 */
export { login } from "./register-login";

/**
 * 校验登录返回的 Bearer token（不含 `Bearer ` 前缀）；无效或过期返回 `null`。
 *
 * 需配置环境变量 `SUDUKU_SESSION_SECRET`（与签发时一致）。
 */
export {
  SUDUKU_SESSION_SECRET_ENV,
  SUDUKU_SESSION_TTL_MS_ENV,
  validateToken,
} from "./session-token";

export {
  LOGIN_FAILED_MESSAGE,
  LoginFailedError,
  RegistrationInputError,
  UsernameTakenError,
  constantTimeEqualCredentialStrings,
} from "./register-login";

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
