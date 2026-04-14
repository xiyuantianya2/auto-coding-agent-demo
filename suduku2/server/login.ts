import crypto from "node:crypto";

import {
  InvalidTokenError,
  InvalidUsernameError,
  UnknownUserError,
  WrongPasswordError,
} from "./errors";
import { getDataDir } from "./data-dir";
import { verifyPassword } from "./password-hash";
import { readSessionsIndex, writeSessionsIndexAtomic } from "./sessions";
import { normalizeUsername, readUsersIndex } from "./users-index";
import type { UserId } from "./types";

/**
 * 生成不透明会话令牌（256-bit 随机，URL-safe Base64）。
 */
function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * 校验用户名与密码后签发会话令牌，并将 `token → userId` 写入 `sessions.json`。
 *
 * **过期策略（内网首版）**：会话**长期有效**，不设 TTL；持久化后**进程重启仍有效**。
 * 若日后需要失效会话，可在此文件增加 `expiresAt` 并在 `getUserIdFromToken` 中校验。
 */
export async function login(
  username: string,
  password: string,
): Promise<{ token: string }> {
  const trimmedUser = username.trim();
  if (!trimmedUser) {
    throw new InvalidUsernameError();
  }

  const key = normalizeUsername(trimmedUser);
  const dataDir = getDataDir();
  const usersIndex = readUsersIndex(dataDir);
  const entry = usersIndex.users[key];
  if (!entry) {
    throw new UnknownUserError();
  }
  if (!verifyPassword(password, entry.password)) {
    throw new WrongPasswordError();
  }

  const token = generateOpaqueToken();
  const sessions = readSessionsIndex(dataDir);
  sessions.sessions[token] = {
    userId: entry.userId,
    createdAt: new Date().toISOString(),
  };
  writeSessionsIndexAtomic(dataDir, sessions);

  return { token };
}

/**
 * 根据不透明令牌解析 `userId`（同步读盘，与 `users-index` 等一致）。
 * 令牌无效、缺失或索引中无记录时抛出 `InvalidTokenError`。
 */
export function getUserIdFromToken(token: string): UserId {
  if (typeof token !== "string" || token.length === 0) {
    throw new InvalidTokenError();
  }

  const dataDir = getDataDir();
  const sessions = readSessionsIndex(dataDir);
  const rec = sessions.sessions[token];
  if (!rec) {
    throw new InvalidTokenError();
  }
  return rec.userId;
}
