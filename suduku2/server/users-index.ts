import fs from "node:fs";
import path from "node:path";

import type { UserId } from "./types";
import type { PasswordRecord } from "./password-hash";

export const USERS_INDEX_FILE = "users-index.json";

/** 索引文件顶层版本，便于日后迁移 */
export type UsersIndexFileV1 = {
  version: 1;
  /**
   * 用户名唯一键 → 凭证与档案。
   * **大小写规则**：键为规范化用户名 `usernameKey`（见 `normalizeUsername`），全小写；
   * 同一字符串在不同大小写下视为同一用户（例如 `Alice` 与 `alice` 互斥）。
   */
  users: Record<
    string,
    {
      userId: UserId;
      /** 首次注册时提交的展示用用户名（已 trim），保留大小写 */
      username: string;
      password: PasswordRecord;
      nickname?: string;
    }
  >;
};

export function usersIndexPath(dataDir: string): string {
  return path.join(dataDir, USERS_INDEX_FILE);
}

export function readUsersIndex(dataDir: string): UsersIndexFileV1 {
  const file = usersIndexPath(dataDir);
  if (!fs.existsSync(file)) {
    return { version: 1, users: {} };
  }
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw) as UsersIndexFileV1;
  if (parsed.version !== 1 || typeof parsed.users !== "object" || parsed.users === null) {
    throw new Error(`suduku2/server: invalid ${USERS_INDEX_FILE} shape`);
  }
  return parsed;
}

export function writeUsersIndexAtomic(dataDir: string, index: UsersIndexFileV1): void {
  const file = usersIndexPath(dataDir);
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const payload = `${JSON.stringify(index, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, payload, "utf8");
  fs.renameSync(tmp, file);
}

/**
 * 用于索引键与唯一性比较：**trim 后转小写**。
 * 文档化规则：用户名唯一性为**不区分大小写**（Unicode 依赖 JS 默认 `toLowerCase()` 语义）。
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
