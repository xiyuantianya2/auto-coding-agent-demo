import crypto from "node:crypto";

import { InvalidPasswordError, InvalidUsernameError, UsernameConflictError } from "./errors";
import { hashPassword } from "./password-hash";
import { getDataDir } from "./data-dir";
import {
  normalizeUsername,
  readUsersIndex,
  writeUsersIndexAtomic,
} from "./users-index";
import type { UserId } from "./types";

/**
 * 注册新用户：校验密码长度、用户名唯一性（见 `users-index` 中大小写规则），
 * 使用 Node `crypto.scrypt` 派生密钥存盐与哈希，**不**存储明文密码。
 * `userId` 使用 `randomUUID()`，写入索引后保持稳定。
 */
export async function register(
  username: string,
  password: string,
  nickname?: string,
): Promise<{ userId: UserId }> {
  const trimmedUser = username.trim();
  if (!trimmedUser) {
    throw new InvalidUsernameError();
  }
  if (password.length < 6) {
    throw new InvalidPasswordError();
  }

  const key = normalizeUsername(trimmedUser);
  const dataDir = getDataDir();
  const index = readUsersIndex(dataDir);

  if (index.users[key]) {
    throw new UsernameConflictError();
  }

  const userId = crypto.randomUUID();
  const passwordRecord = hashPassword(password);

  const nick =
    nickname === undefined ? undefined : nickname.trim();
  index.users[key] = {
    userId,
    username: trimmedUser,
    password: passwordRecord,
    ...(nick ? { nickname: nick } : {}),
  };

  writeUsersIndexAtomic(dataDir, index);
  return { userId };
}
