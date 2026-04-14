import fs from "node:fs";
import path from "node:path";

import type { UserId } from "./types";

export const SESSIONS_FILE = "sessions.json";

export type SessionRecordV1 = {
  userId: UserId;
  /** ISO 8601，便于排查与日后 TTL */
  createdAt: string;
};

export type SessionsFileV1 = {
  version: 1;
  sessions: Record<string, SessionRecordV1>;
};

export function sessionsPath(dataDir: string): string {
  return path.join(dataDir, SESSIONS_FILE);
}

export function readSessionsIndex(dataDir: string): SessionsFileV1 {
  const file = sessionsPath(dataDir);
  if (!fs.existsSync(file)) {
    return { version: 1, sessions: {} };
  }
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw) as SessionsFileV1;
  if (parsed.version !== 1 || typeof parsed.sessions !== "object" || parsed.sessions === null) {
    throw new Error(`suduku2/server: invalid ${SESSIONS_FILE} shape`);
  }
  return parsed;
}

/**
 * 原子替换写入：先写临时文件再 `rename`，同卷上一般为原子操作，减少并发下读到半截 JSON 的概率。
 */
export function writeSessionsIndexAtomic(dataDir: string, index: SessionsFileV1): void {
  const file = sessionsPath(dataDir);
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const payload = `${JSON.stringify(index, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, payload, "utf8");
  fs.renameSync(tmp, file);
}
