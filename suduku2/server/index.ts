/**
 * # suduku2/server — 局域网服务、账号与 JSON 持久化
 *
 * 对外导出与 `module-plan.json` 中 **server-api** 模块的 interface 一致。
 * 当前进度：`getDataDir()`、`register()`、`login()`、`getUserIdFromToken()`、`getProgress()`（含 `global` 无尽池）、
 * `saveProgress()`、`exportProgress()`、`importProgress()` 已实现；内网 HTTP 契约见 `app/api/` Route Handlers（委托本模块，错误 JSON 形状见 `http.ts`）。
 *
 * ## 数据目录 `getDataDir()`
 *
 * - **默认**：`{项目根}/data`，其中「项目根」取运行时 `process.cwd()`。在仓库内于 `suduku2/` 下执行
 *   `npm run dev` / `npm test` 等脚本时，一般为 `suduku2/data`。
 * - **覆盖**：环境变量 `SUDUKU2_DATA_DIR`（见 `data-dir.ts` 中 `SUDUKU2_DATA_DIR_ENV` 常量），值为绝对或相对路径，
 *   经 `path.resolve` 后作为数据根目录。
 * - **存在性**：首次调用 `getDataDir()` 时使用 `fs.mkdirSync(..., { recursive: true })` 确保目录存在。
 *
 * ## 约定 JSON 文件布局（相对数据根目录；后续任务落盘）
 *
 * | 相对路径 | 内容 |
 * |----------|------|
 * | `users-index.json` | 用户名键（**不区分大小写**，存为小写）→ `userId`、密码 scrypt 哈希与盐、可选昵称 |
 * | `sessions.json` | 不透明会话 token → `userId`（及可选过期元数据） |
 * | `global/endless.json` | `EndlessGlobalState`：四档难度共享无尽关卡池（`maxPreparedLevel`、按关卡号索引的 `puzzles`） |
 * | `users/<userId>.json` | 单用户 `UserProgress`（`techniques`、`practice`、`endless`、`draft`、`settings`） |
 *
 * 导出/导入进度可用独立文件名或内嵌在用户文件中，由后续任务固定并保持稳定。
 */

export type {
  DifficultyTier,
  EndlessGlobalState,
  PuzzleSpec,
  UserId,
  UserProgress,
  UserProgressPatch,
} from "./types";

export { SUDUKU2_DATA_DIR_ENV, getDataDir } from "./data-dir";

export {
  InvalidPasswordError,
  InvalidTokenError,
  InvalidUsernameError,
  UnknownUserError,
  UsernameConflictError,
  WrongPasswordError,
} from "./errors";

export { register } from "./register";

export { getUserIdFromToken, login } from "./login";

export {
  MAX_IMPORT_JSON_BYTES,
  USER_PROGRESS_EXPORT_FORMAT,
  exportProgress,
  getProgress,
  importProgress,
  saveProgress,
} from "./progress";

