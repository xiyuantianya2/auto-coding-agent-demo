import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ensureDirExists } from "./data-root";
import { getUsernameIndexPath } from "./paths";

export type UsernameIndexV1 = {
  v: 1;
  /** 规范化后的用户名 → {@link UserId}（见 `server/register-login.ts` 的规范化规则）。 */
  usernameToUserId: Record<string, string>;
};

export function createEmptyUsernameIndex(): UsernameIndexV1 {
  return { v: 1, usernameToUserId: {} };
}

function parseUsernameIndex(raw: unknown): UsernameIndexV1 {
  if (raw === null || typeof raw !== "object") {
    return createEmptyUsernameIndex();
  }
  const o = raw as Record<string, unknown>;
  if (o.v !== 1 || typeof o.usernameToUserId !== "object" || o.usernameToUserId === null) {
    return createEmptyUsernameIndex();
  }
  const map = o.usernameToUserId as Record<string, unknown>;
  const usernameToUserId: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === "string" && v !== "") {
      usernameToUserId[k] = v;
    }
  }
  return { v: 1, usernameToUserId };
}

/**
 * 读取 `username-index.json`；缺失或不可解析时视为空索引（与首次启动一致）。
 */
export async function readUsernameIndexFile(dataRoot: string): Promise<UsernameIndexV1> {
  const filePath = getUsernameIndexPath(dataRoot);
  let raw: string;
  try {
    raw = await fs.promises.readFile(filePath, "utf8");
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return createEmptyUsernameIndex();
    }
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createEmptyUsernameIndex();
  }
  return parseUsernameIndex(parsed);
}

function stableStringifyIndex(index: UsernameIndexV1): string {
  return `${JSON.stringify(index)}\n`;
}

/** 原子替换写入用户名索引。 */
export async function writeUsernameIndexFileAtomic(dataRoot: string, index: UsernameIndexV1): Promise<void> {
  await ensureDirExists(dataRoot);
  const finalPath = getUsernameIndexPath(dataRoot);
  const tmpName = `.${path.basename(finalPath)}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  const tmpPath = path.join(dataRoot, tmpName);
  const body = stableStringifyIndex(index);

  await fs.promises.writeFile(tmpPath, body, { encoding: "utf8", flag: "wx" });
  try {
    await fs.promises.rename(tmpPath, finalPath);
  } catch (e) {
    await fs.promises.unlink(tmpPath).catch(() => {});
    throw e;
  }
}
