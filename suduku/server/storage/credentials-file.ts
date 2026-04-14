import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ensureDirExists } from "./data-root";
import { getUserCredentialsPath, getUserDir } from "./paths";

export type UserCredentialsFileV1 = {
  v: 1;
  /**
   * 与注册请求体 `passwordHash` 完全一致的字节串（服务端不解码、不二次哈希）。
   * 登录时与 `login(username, password)` 的 `password` 做常量时间相等性校验（见模块注释）。
   */
  passwordHash: string;
};

export async function readUserCredentialsFile(
  dataRoot: string,
  userId: string,
): Promise<UserCredentialsFileV1 | null> {
  const filePath = getUserCredentialsPath(dataRoot, userId);
  let raw: string;
  try {
    raw = await fs.promises.readFile(filePath, "utf8");
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  if (o.v !== 1 || typeof o.passwordHash !== "string") {
    return null;
  }
  return { v: 1, passwordHash: o.passwordHash };
}

/** 原子写入 `users/<userId>/credentials.json`。 */
export async function writeUserCredentialsFileAtomic(
  dataRoot: string,
  userId: string,
  body: UserCredentialsFileV1,
): Promise<void> {
  const userDir = getUserDir(dataRoot, userId);
  await ensureDirExists(userDir);
  const finalPath = getUserCredentialsPath(dataRoot, userId);
  const tmpName = `.${path.basename(finalPath)}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  const tmpPath = path.join(userDir, tmpName);
  const out = `${JSON.stringify(body)}\n`;

  await fs.promises.writeFile(tmpPath, out, { encoding: "utf8", flag: "wx" });
  try {
    await fs.promises.rename(tmpPath, finalPath);
  } catch (e) {
    await fs.promises.unlink(tmpPath).catch(() => {});
    throw e;
  }
}
