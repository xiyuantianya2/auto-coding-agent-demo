/**
 * 每用户进度文件：`{dataDir}/users/<userId>.json`
 *
 * ## `saveProgress(token, patch)` 合并规则（last-write-wins）
 *
 * - **文件级**：每次 `saveProgress` 在内存中合并后 **整文件原子替换**（`write`+`rename`）。多设备并发时以**最后一次成功落盘**为准，不做 CRDT。
 * - **顶层键**：仅处理 `techniques` / `practice` / `endless` / `settings` / `draft`；未出现在 `patch` 中的字段沿用当前存档。
 * - **`techniques` / `practice`**：与当前对象做 **一层深合并**——按子键（技巧 id、练习 id）合并；同一子键的对象字段以 `patch` 覆盖（`{ ...existing[id], ...patch[id] }`）。
 * - **`endless`**：对四档难度分别做 **一层深合并**——仅合并 `patch.endless` 中出现的档位；该档下 `{ clearedLevel }` 以 `patch` 为准并与已有字段合并。
 * - **`settings`**：浅合并 `{ ...current.settings, ...patch.settings }`（`patch.settings` 存在时）。
 * - **`draft`**：若 `patch` **带有自有属性** `draft`（含显式 `undefined` 以清除草稿），则 **整份草稿替换或删除**；否则不改。写入磁盘前将 {@link GameState} 规范为与 `@/lib/core` 的 `serializeGameState` **相同的 JSON 对象形状**（`JSON.parse(serializeGameState(state))`），读出时用 `deserializeGameState` 还原为运行时 `GameState`（含 `Set` 笔记）。
 */

import fs from "node:fs";
import path from "node:path";

import {
  cloneGameState,
  deserializeGameState,
  serializeGameState,
  type GameState,
} from "@/lib/core";

import { getDataDir } from "./data-dir";
import { getUserIdFromToken } from "./login";
import type { DifficultyTier, EndlessGlobalState, PuzzleSpec, UserId, UserProgress } from "./types";

export const USERS_SUBDIR = "users";

const DIFFICULTY_TIERS: DifficultyTier[] = ["entry", "normal", "hard", "expert"];

export function userProgressPath(dataDir: string, userId: UserId): string {
  return path.join(dataDir, USERS_SUBDIR, `${userId}.json`);
}

export function emptyEndlessGlobalState(): EndlessGlobalState {
  const emptyTier = { maxPreparedLevel: 0, puzzles: {} as Record<number, PuzzleSpec> };
  return {
    entry: { ...emptyTier },
    normal: { ...emptyTier },
    hard: { ...emptyTier },
    expert: { ...emptyTier },
  };
}

export function defaultUserProgress(): UserProgress {
  return {
    techniques: {},
    practice: {},
    endless: {
      entry: { clearedLevel: 0 },
      normal: { clearedLevel: 0 },
      hard: { clearedLevel: 0 },
      expert: { clearedLevel: 0 },
    },
  };
}

type UserProgressFileV1 = {
  version: 1;
  techniques: UserProgress["techniques"];
  practice: UserProgress["practice"];
  endless: UserProgress["endless"];
  /** 与 `serializeGameState` 解析后的 JSON 对象同形（非 GameState 运行时对象）。 */
  draft?: unknown;
  settings?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertUserProgressShape(p: unknown): asserts p is Omit<UserProgressFileV1, "version"> {
  if (!isRecord(p)) throw new Error("suduku2/server: user progress root must be an object");
  if (!isRecord(p.techniques)) throw new Error("suduku2/server: invalid techniques");
  if (!isRecord(p.practice)) throw new Error("suduku2/server: invalid practice");
  if (!isRecord(p.endless)) throw new Error("suduku2/server: invalid endless");
  for (const tier of DIFFICULTY_TIERS) {
    const t = p.endless[tier];
    if (!isRecord(t) || typeof t.clearedLevel !== "number" || !Number.isInteger(t.clearedLevel)) {
      throw new Error(`suduku2/server: invalid endless.${tier}`);
    }
  }
}

function readUserProgressFile(dataDir: string, userId: UserId): UserProgress {
  const file = userProgressPath(dataDir, userId);
  if (!fs.existsSync(file)) {
    return defaultUserProgress();
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (!isRecord(raw) || raw.version !== 1) {
    throw new Error("suduku2/server: invalid user progress file version");
  }
  const techniques = raw.techniques;
  const practice = raw.practice;
  const endless = raw.endless;
  const settings = raw.settings;
  const draftWire = raw.draft;
  assertUserProgressShape({ techniques, practice, endless });
  const base: UserProgress = {
    techniques: techniques as UserProgress["techniques"],
    practice: practice as UserProgress["practice"],
    endless: endless as UserProgress["endless"],
    ...(settings !== undefined ? { settings: settings as Record<string, unknown> } : {}),
  };
  if (draftWire !== undefined) {
    base.draft = deserializeGameState(JSON.stringify(draftWire));
  }
  return base;
}

/**
 * 将 `draft` 规范为可落盘的 wire 对象（与 `JSON.parse(serializeGameState(GameState))` 同形）。
 * 运行时 {@link GameState} 含 `Set`，不可用 `JSON.stringify` 直接交给 `deserializeGameState`。
 */
function draftToWire(draft: unknown): unknown {
  if (draft === undefined) return undefined;
  if (typeof draft === "string") {
    return JSON.parse(serializeGameState(deserializeGameState(draft))) as unknown;
  }
  const state: GameState =
    isRecord(draft) && "grid" in draft && "cells" in draft && "mode" in draft
      ? cloneGameState(draft as unknown as GameState)
      : deserializeGameState(JSON.stringify(draft));
  return JSON.parse(serializeGameState(state)) as unknown;
}

function userProgressToFile(progress: UserProgress): UserProgressFileV1 {
  const draftWire = progress.draft === undefined ? undefined : draftToWire(progress.draft);
  return {
    version: 1,
    techniques: progress.techniques,
    practice: progress.practice,
    endless: progress.endless,
    ...(draftWire !== undefined ? { draft: draftWire } : {}),
    ...(progress.settings !== undefined ? { settings: progress.settings } : {}),
  };
}

/**
 * 原子写入用户进度文件（同卷 rename）。
 */
export function writeUserProgressAtomic(dataDir: string, userId: UserId, progress: UserProgress): void {
  const file = userProgressPath(dataDir, userId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = `${JSON.stringify(userProgressToFile(progress), null, 2)}\n`;
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, payload, "utf8");
  fs.renameSync(tmp, file);
}

function mergeTechniques(
  current: UserProgress["techniques"],
  patch: UserProgress["techniques"] | undefined,
): UserProgress["techniques"] {
  if (!patch) return current;
  const out: UserProgress["techniques"] = { ...current };
  for (const id of Object.keys(patch)) {
    const p = patch[id];
    if (!p) continue;
    out[id] = { ...(current[id] ?? { unlocked: false }), ...p };
  }
  return out;
}

function mergePractice(
  current: UserProgress["practice"],
  patch: UserProgress["practice"] | undefined,
): UserProgress["practice"] {
  if (!patch) return current;
  const out: UserProgress["practice"] = { ...current };
  for (const id of Object.keys(patch)) {
    const p = patch[id];
    if (!p) continue;
    out[id] = { ...(current[id] ?? {}), ...p };
  }
  return out;
}

function mergeEndless(
  current: UserProgress["endless"],
  patch: UserProgress["endless"] | undefined,
): UserProgress["endless"] {
  if (!patch) return current;
  const out: UserProgress["endless"] = { ...current };
  for (const tier of DIFFICULTY_TIERS) {
    if (!(tier in patch) || patch[tier] === undefined) continue;
    out[tier] = { ...current[tier], ...patch[tier] };
  }
  return out;
}

export function mergeUserProgress(current: UserProgress, patch: Partial<UserProgress>): UserProgress {
  const next: UserProgress = {
    techniques: mergeTechniques(current.techniques, patch.techniques),
    practice: mergePractice(current.practice, patch.practice),
    endless: mergeEndless(current.endless, patch.endless),
  };
  if (patch.settings !== undefined) {
    next.settings = { ...(current.settings ?? {}), ...patch.settings };
  } else if (current.settings !== undefined) {
    next.settings = { ...current.settings };
  }
  if (Object.prototype.hasOwnProperty.call(patch, "draft")) {
    if (patch.draft === undefined) {
      /* omit draft */
    } else {
      next.draft = cloneGameState(patch.draft as GameState);
    }
  } else if (current.draft !== undefined) {
    next.draft = cloneGameState(current.draft as GameState);
  }
  return next;
}

/**
 * 校验令牌后读取并返回用户进度；`global` 占位为空池（由后续任务填充或路由层合并）。
 */
export async function getProgress(
  token: string,
): Promise<UserProgress & { global: EndlessGlobalState }> {
  const userId = getUserIdFromToken(token);
  const dataDir = getDataDir();
  const progress = readUserProgressFile(dataDir, userId);
  return { ...progress, global: emptyEndlessGlobalState() };
}

export async function saveProgress(token: string, patch: Partial<UserProgress>): Promise<void> {
  const userId = getUserIdFromToken(token);
  const dataDir = getDataDir();
  const current = readUserProgressFile(dataDir, userId);
  const merged = mergeUserProgress(current, patch);
  writeUserProgressAtomic(dataDir, userId, merged);
}
