import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createEmptyProgressPayload, type ProgressPayload } from "../progress-types";

import { ensureDirExists } from "./data-root";
import { getUserDir, getUserProgressPath } from "./paths";
import { parseProgressPayload, ProgressPayloadValidationError } from "./progress-payload";

export class ProgressFileParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProgressFileParseError";
  }
}

function isNodeError(e: unknown): e is NodeJS.ErrnoException {
  return typeof e === "object" && e !== null && "code" in e;
}

/**
 * 从磁盘读取 `users/<userId>/progress.json`。
 *
 * - 文件不存在：返回空默认结构。
 * - JSON 语法错误或校验失败：抛出 {@link ProgressFileParseError} 或 {@link ProgressPayloadValidationError}。
 */
export async function readUserProgressFile(
  dataRoot: string,
  userId: string,
): Promise<ProgressPayload> {
  const filePath = getUserProgressPath(dataRoot, userId);
  let raw: string;
  try {
    raw = await fs.promises.readFile(filePath, "utf8");
  } catch (e) {
    if (isNodeError(e) && e.code === "ENOENT") {
      return createEmptyProgressPayload();
    }
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ProgressFileParseError(`progress.json is not valid JSON: ${filePath}`, {
      cause: e,
    });
  }

  try {
    return parseProgressPayload(parsed);
  } catch (e) {
    if (e instanceof ProgressPayloadValidationError) {
      throw new ProgressFileParseError(
        `progress.json failed validation: ${filePath}: ${e.message}`,
        { cause: e },
      );
    }
    throw e;
  }
}

function stableStringifyProgress(payload: ProgressPayload): string {
  const normalize = {
    endless: payload.endless,
    practice: payload.practice,
    tutorial: payload.tutorial,
  };
  return `${JSON.stringify(normalize)}\n`;
}

/**
 * 原子替换写入：先写同目录临时文件，再 `rename` 覆盖 `progress.json`。
 *
 * @throws {ProgressPayloadValidationError} `data` 未通过校验时（不写盘）
 */
export async function writeUserProgressFileAtomic(
  dataRoot: string,
  userId: string,
  data: unknown,
): Promise<void> {
  const validated = parseProgressPayload(data);
  const userDir = getUserDir(dataRoot, userId);
  await ensureDirExists(userDir);

  const finalPath = getUserProgressPath(dataRoot, userId);
  const tmpName = `.${path.basename(finalPath)}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  const tmpPath = path.join(userDir, tmpName);
  const body = stableStringifyProgress(validated);

  await fs.promises.writeFile(tmpPath, body, { encoding: "utf8", flag: "wx" });
  try {
    await fs.promises.rename(tmpPath, finalPath);
  } catch (e) {
    await fs.promises.unlink(tmpPath).catch(() => {});
    throw e;
  }
}
