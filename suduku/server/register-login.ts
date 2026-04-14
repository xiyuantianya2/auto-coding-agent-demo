import crypto from "node:crypto";
import fs from "node:fs";

import { ensureDirExists, resolveSudukuDataDir } from "./storage/data-root";
import {
  readUserCredentialsFile,
  writeUserCredentialsFileAtomic,
  type UserCredentialsFileV1,
} from "./storage/credentials-file";
import { getUserDir } from "./storage/paths";
import { readUsernameIndexFile, writeUsernameIndexFileAtomic } from "./storage/username-index";

/**
 * ## 产品语义：`passwordHash` 与 `login` 的 `password`（任务 3 固定契约）
 *
 * - **`registerUser(..., passwordHash)`**：客户端（或网关）在注册请求中提交的**可持久化凭证材料**的字符串形式。
 *   服务端**按原样**写入 `credentials.json`，不在此模块做 bcrypt/scrypt 等二次哈希或解码。
 * - **`login(username, password)`**：调用方传入的**与注册时同一套约定**的比对材料：若注册上传的是十六进制 SHA-256
 *   摘要，则登录时 `password` 也应为同一格式的摘要串；若注册上传明文（不推荐），则登录传同一明文。
 *   校验方式为常量时间比较两串是否相等（实现上对两串做 SHA-256 后再 `timingSafeEqual`，避免长度分支泄露）。
 *
 * 这样前后端对「注册字段名 passwordHash」与「登录字段名 password」的含义一致：**同一字节序列在不同 API 下的名称不同**，
 * 而非「一个哈希、一个明文」。
 */

/** 登录失败时对调用方可见的**统一**文案（不区分用户名是否存在，避免枚举）。 */
export const LOGIN_FAILED_MESSAGE = "Invalid username or password.";

export class UsernameTakenError extends Error {
  constructor(message = "Username is already taken.") {
    super(message);
    this.name = "UsernameTakenError";
  }
}

export class LoginFailedError extends Error {
  constructor(message = LOGIN_FAILED_MESSAGE) {
    super(message);
    this.name = "LoginFailedError";
  }
}

export class RegistrationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationInputError";
  }
}

/** 无此用户时仍走校验分支用的占位串（进程内固定，不写入磁盘）。 */
const INVALID_USER_PLACEHOLDER_HASH =
  "0192f8a8-7e7b-7f77-8000-000000000000-login-placeholder-no-such-user";

function normalizeUsername(username: string): string {
  return username.trim();
}

function assertNonEmptyUsername(username: string): void {
  if (username === "") {
    throw new RegistrationInputError("Username is required.");
  }
}

/**
 * 对两段字符串做 SHA-256 后以 `timingSafeEqual` 比较，避免按字节短路比较；
 * 用于「注册摘要 / 登录比对材料」的相等性判断。
 */
export function constantTimeEqualCredentialStrings(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function removeUserTree(dataRoot: string, userId: string): Promise<void> {
  const dir = getUserDir(dataRoot, userId);
  await fs.promises.rm(dir, { recursive: true, force: true });
}

export async function registerUser(username: string, passwordHash: string): Promise<string> {
  const dataRoot = resolveSudukuDataDir();
  await ensureDirExists(dataRoot);

  const u = normalizeUsername(username);
  assertNonEmptyUsername(u);
  if (passwordHash === "") {
    throw new RegistrationInputError("passwordHash must be non-empty.");
  }

  const first = await readUsernameIndexFile(dataRoot);
  if (first.usernameToUserId[u] !== undefined) {
    throw new UsernameTakenError();
  }

  const userId = crypto.randomUUID();
  const creds: UserCredentialsFileV1 = { v: 1, passwordHash };

  try {
    await writeUserCredentialsFileAtomic(dataRoot, userId, creds);

    const again = await readUsernameIndexFile(dataRoot);
    if (again.usernameToUserId[u] !== undefined) {
      await removeUserTree(dataRoot, userId);
      throw new UsernameTakenError();
    }

    again.usernameToUserId[u] = userId;
    await writeUsernameIndexFileAtomic(dataRoot, again);
  } catch (e) {
    if (e instanceof UsernameTakenError) {
      throw e;
    }
    await removeUserTree(dataRoot, userId).catch(() => {});
    throw e;
  }

  return userId;
}

export async function login(username: string, password: string): Promise<{ token: string }> {
  const dataRoot = resolveSudukuDataDir();
  const u = normalizeUsername(username);

  const index = await readUsernameIndexFile(dataRoot);
  const userId = index.usernameToUserId[u];

  let expectedMaterial: string = INVALID_USER_PLACEHOLDER_HASH;
  if (userId !== undefined) {
    const file = await readUserCredentialsFile(dataRoot, userId);
    if (file !== null) {
      expectedMaterial = file.passwordHash;
    }
  }

  if (!constantTimeEqualCredentialStrings(password, expectedMaterial)) {
    throw new LoginFailedError();
  }

  if (userId === undefined) {
    throw new LoginFailedError();
  }

  const token = crypto.randomBytes(32).toString("base64url");
  return { token };
}
