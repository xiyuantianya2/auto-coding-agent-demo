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
import { getTechniqueCatalog, getUnlockGraph } from "@/content/curriculum";
import { TIER_PROFILES } from "@/lib/generator/tier-profiles";

import { getDataDir } from "./data-dir";
import { refreshEndlessGlobalPool } from "./endless-pool";
import { getUserIdFromToken } from "./login";
import type { DifficultyTier, EndlessGlobalState, UserId, UserProgress, UserProgressPatch } from "./types";

export const USERS_SUBDIR = "users";

const DIFFICULTY_TIERS: DifficultyTier[] = ["entry", "normal", "hard", "expert"];

export { emptyEndlessGlobalState } from "./endless-pool";

export function userProgressPath(dataDir: string, userId: UserId): string {
  return path.join(dataDir, USERS_SUBDIR, `${userId}.json`);
}

export function defaultUserProgress(): UserProgress {
  const catalog = getTechniqueCatalog();
  const entryTechnique = catalog[0];
  return {
    techniques: entryTechnique ? { [entryTechnique.id]: { unlocked: true } } : {},
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
    if (!isRecord(t) || typeof t.clearedLevel !== "number" || !Number.isInteger(t.clearedLevel) || t.clearedLevel < 0) {
      throw new Error(`suduku2/server: invalid endless.${tier}`);
    }
  }
}

/**
 * 自磁盘/导入快照中的 `UserProgressFileV1` 还原运行时 {@link UserProgress}。
 */
function userProgressFromWireObject(raw: UserProgressFileV1): UserProgress {
  const { techniques, practice, endless, settings, draft: draftWire } = raw;
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

function readUserProgressFile(dataDir: string, userId: UserId): UserProgress {
  const file = userProgressPath(dataDir, userId);
  if (!fs.existsSync(file)) {
    return defaultUserProgress();
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (!isRecord(raw) || raw.version !== 1) {
    throw new Error("suduku2/server: invalid user progress file version");
  }
  return userProgressFromWireObject(raw as UserProgressFileV1);
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
  patch: Partial<UserProgress["endless"]> | undefined,
): UserProgress["endless"] {
  if (!patch) return current;
  const out: UserProgress["endless"] = { ...current };
  for (const tier of DIFFICULTY_TIERS) {
    if (!(tier in patch) || patch[tier] === undefined) continue;
    out[tier] = { ...current[tier], ...patch[tier] };
  }
  return out;
}

export function mergeUserProgress(current: UserProgress, patch: UserProgressPatch): UserProgress {
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
 * 校验令牌后读取并返回用户进度；`global` 为共享无尽池（见 `endless-pool.ts` 刷新逻辑）。
 */
export async function getProgress(
  token: string,
): Promise<UserProgress & { global: EndlessGlobalState }> {
  const userId = getUserIdFromToken(token);
  const dataDir = getDataDir();
  const progress = readUserProgressFile(dataDir, userId);
  const global = refreshEndlessGlobalPool(dataDir);
  return { ...progress, global };
}

/**
 * 根据无尽关卡通关进度，自动解锁对应难度档位的技巧。
 * 规则：若用户在某档位 clearedLevel >= 1，则该档位 allowedTechniques 中的所有技巧
 * 及其在解锁图中的前置技巧，均标记为 unlocked。
 */
function autoUnlockTechniquesFromEndless(progress: UserProgress): void {
  const catalog = getTechniqueCatalog();
  const catalogIds = new Set(catalog.map((m) => m.id));
  const graph = getUnlockGraph();
  const requiresMap = new Map(graph.map((e) => [e.techniqueId, e.requires]));

  const toUnlock = new Set<string>();

  for (const tier of DIFFICULTY_TIERS) {
    if (progress.endless[tier].clearedLevel >= 1) {
      const profile = TIER_PROFILES[tier];
      for (const techId of profile.allowedTechniques) {
        if (catalogIds.has(techId)) {
          toUnlock.add(techId);
        }
      }
    }
  }

  // Also unlock all prerequisites transitively
  const visited = new Set<string>();
  function addPrereqs(techId: string): void {
    if (visited.has(techId)) return;
    visited.add(techId);
    const reqs = requiresMap.get(techId);
    if (reqs) {
      for (const req of reqs) {
        toUnlock.add(req);
        addPrereqs(req);
      }
    }
  }
  for (const id of [...toUnlock]) {
    addPrereqs(id);
  }

  for (const id of toUnlock) {
    if (!progress.techniques[id]?.unlocked) {
      progress.techniques[id] = { ...(progress.techniques[id] ?? {}), unlocked: true };
    }
  }
}

export async function saveProgress(token: string, patch: UserProgressPatch): Promise<void> {
  const userId = getUserIdFromToken(token);
  const dataDir = getDataDir();
  const current = readUserProgressFile(dataDir, userId);
  const merged = mergeUserProgress(current, patch);
  autoUnlockTechniquesFromEndless(merged);
  writeUserProgressAtomic(dataDir, userId, merged);
  refreshEndlessGlobalPool(dataDir);
}

/** 与 `exportProgress` 写出 JSON 中的 `format` 字段一致，用于版本化与校验。 */
export const USER_PROGRESS_EXPORT_FORMAT = "suduku2-user-progress-v1" as const;

/** 导入 JSON 字符串最大字节数（UTF-16 引擎下按 `.length` 近似约束，防恶意超大 payload）。 */
export const MAX_IMPORT_JSON_BYTES = 2 * 1024 * 1024;

type UserProgressExportEnvelopeV1 = {
  exportVersion: 1;
  format: typeof USER_PROGRESS_EXPORT_FORMAT;
  progress: UserProgressFileV1;
};

/**
 * 导出当前登录用户的进度为可长期保存的 JSON 字符串。
 *
 * ## 内容边界（稳定契约）
 *
 * - **不包含**会话 token、`userId`、用户名、密码或任何登录凭证。
 * - **仅包含**用户进度快照：根对象含 `exportVersion`、`format`、`progress`；`progress` 与磁盘文件
 *   `users/<userId>.json` 同形（`version: 1` 与 `techniques` / `practice` / `endless` / 可选 `draft` / `settings`），
 *   其中 `draft` 为与 `serializeGameState` 一致的 JSON 对象，而非含 `Set` 的运行时 {@link GameState}。
 * - **不包含**无尽全局池 `global`（`EndlessGlobalState` 为服务器派生共享状态，不应随用户备份文件漂移）。
 */
export async function exportProgress(token: string): Promise<string> {
  const userId = getUserIdFromToken(token);
  const dataDir = getDataDir();
  const progress = readUserProgressFile(dataDir, userId);
  const wire = userProgressToFile(progress);
  const envelope: UserProgressExportEnvelopeV1 = {
    exportVersion: 1,
    format: USER_PROGRESS_EXPORT_FORMAT,
    progress: wire,
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

function parseImportedUserProgressJson(json: string): UserProgress {
  if (json.length > MAX_IMPORT_JSON_BYTES) {
    throw new Error(
      `suduku2/server: import JSON exceeds max length (${MAX_IMPORT_JSON_BYTES} code units)`,
    );
  }
  let root: unknown;
  try {
    root = JSON.parse(json);
  } catch {
    throw new Error("suduku2/server: import JSON parse failed");
  }
  if (!isRecord(root)) {
    throw new Error("suduku2/server: import root must be an object");
  }
  if (root.exportVersion !== 1) {
    throw new Error("suduku2/server: unsupported import exportVersion");
  }
  if (root.format !== USER_PROGRESS_EXPORT_FORMAT) {
    throw new Error("suduku2/server: unexpected import format");
  }
  const progressRaw = root.progress;
  if (!isRecord(progressRaw) || progressRaw.version !== 1) {
    throw new Error("suduku2/server: invalid imported progress.version");
  }
  return userProgressFromWireObject(progressRaw as UserProgressFileV1);
}

/**
 * 自备份 JSON 恢复用户进度。
 *
 * ## 合并 / 覆盖策略
 *
 * 校验通过后，将快照 **整份替换** 当前用户存档（`writeUserProgressAtomic`），与 `saveProgress` 一致采用
 * **last-write-wins**：本次导入作为一次成功的完整写入，覆盖服务器上已有进度；不做与旧存档的字段级合并，
 * 以免备份还原时残留旧技巧/关卡。导入后刷新无尽全局池（与 `saveProgress` 相同）。
 *
 * ## 安全
 *
 * 解析前限制字符串大小 {@link MAX_IMPORT_JSON_BYTES}；`JSON.parse` 失败或形状/version 不匹配则抛错，不落盘。
 */
export async function importProgress(token: string, json: string): Promise<void> {
  const userId = getUserIdFromToken(token);
  const dataDir = getDataDir();
  const next = parseImportedUserProgressJson(json);
  writeUserProgressAtomic(dataDir, userId, next);
  refreshEndlessGlobalPool(dataDir);
}
