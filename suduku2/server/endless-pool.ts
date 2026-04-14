/**
 * 共享无尽关卡池：`{dataDir}/global/endless.json`
 *
 * - 扫描 `users/*.json` 得到每档最大 `clearedLevel`，记为 `maxCleared`。
 * - 持久化池中需包含关卡 **1 … maxCleared + 1**（全用户一致）。
 * - 出题仅通过 `@/lib/generator` 的 `generatePuzzle`；落盘前裁剪为契约形状 `{ seed, givens, difficultyScore }`。
 * - 生成器单次调用使用 `timeoutMs`（默认与生成器一致 5000ms）；高档位失败时有限次换种子重试并 `console.warn`。
 */

import fs from "node:fs";
import path from "node:path";

import crypto from "node:crypto";

import { generatePuzzle, type PuzzleSpec as GeneratorPuzzleSpec } from "@/lib/generator";

import type { DifficultyTier, EndlessGlobalState, PuzzleSpec } from "./types";

export const GLOBAL_ENDLESS_REL_PATH = path.join("global", "endless.json");

const USERS_DIR = "users";

/** 与生成器默认单次预算一致；单次调用目标通常 < 5s */
const GENERATE_TIMEOUT_MS = 5000;

/** 池版本号：写入 RNG 种子串，变更后视为新池世代 */
const ENDLESS_POOL_DATA_VERSION = 1;

const DIFFICULTY_TIERS: DifficultyTier[] = ["entry", "normal", "hard", "expert"];

export function emptyEndlessGlobalState(): EndlessGlobalState {
  const emptyTier = { maxPreparedLevel: 0, puzzles: {} as Record<number, PuzzleSpec> };
  return {
    entry: { ...emptyTier },
    normal: { ...emptyTier },
    hard: { ...emptyTier },
    expert: { ...emptyTier },
  };
}

/** 高档位生成失败时的额外种子尝试次数（每次仍受 timeoutMs 约束） */
const MAX_SEED_ATTEMPTS: Record<DifficultyTier, number> = {
  entry: 12,
  normal: 12,
  hard: 10,
  expert: 4,
};

type EndlessGlobalFileV1 = {
  version: 1;
  state: EndlessGlobalState;
};

export function endlessGlobalPath(dataDir: string): string {
  return path.join(dataDir, GLOBAL_ENDLESS_REL_PATH);
}

export function mapGeneratorSpecToPublic(spec: GeneratorPuzzleSpec): PuzzleSpec {
  return {
    seed: spec.seed,
    givens: spec.givens,
    difficultyScore: spec.difficultyScore,
  };
}

function seedKeyForAttempt(tier: DifficultyTier, level: number, attempt: number): string {
  return `suduku2:endless:v${ENDLESS_POOL_DATA_VERSION}|${tier}|L${level}|a${attempt}`;
}

function hashStringToUint32(s: string): number {
  const h = crypto.createHash("sha256").update(s, "utf8").digest();
  return h.readUInt32BE(0);
}

/** 确定性 RNG：`[0,1)`，同一 seed 字节序列稳定（不保证与 wall-clock 无关的生成器内部一致，但用于 `generatePuzzle` 足够）。 */
export function createRngFromSeedKey(seedKey: string): () => number {
  let state = hashStringToUint32(seedKey) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizePuzzlesKeys(puzzles: Record<number, PuzzleSpec>): Record<number, PuzzleSpec> {
  const out: Record<number, PuzzleSpec> = {};
  for (const [k, spec] of Object.entries(puzzles) as Array<[string, PuzzleSpec]>) {
    const n = Number(k);
    if (!Number.isInteger(n) || n < 1) continue;
    out[n] = spec;
  }
  return out;
}

function isPuzzleSpecWire(x: unknown): x is PuzzleSpec {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.seed === "string" &&
    Array.isArray(o.givens) &&
    typeof o.difficultyScore === "number"
  );
}

export function readEndlessGlobalState(dataDir: string): EndlessGlobalState {
  const file = endlessGlobalPath(dataDir);
  if (!fs.existsSync(file)) {
    return emptyEndlessGlobalState();
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null || (raw as EndlessGlobalFileV1).version !== 1) {
    throw new Error("suduku2/server: invalid global/endless.json version");
  }
  const st = (raw as EndlessGlobalFileV1).state;
  if (typeof st !== "object" || st === null) {
    throw new Error("suduku2/server: invalid global/endless.json state");
  }
  const out = emptyEndlessGlobalState();
  for (const tier of DIFFICULTY_TIERS) {
    const tierState = (st as EndlessGlobalState)[tier];
    if (typeof tierState !== "object" || tierState === null) {
      throw new Error(`suduku2/server: invalid endless tier ${tier}`);
    }
    const mp = tierState.maxPreparedLevel;
    const puzzlesRaw = tierState.puzzles;
    if (typeof mp !== "number" || !Number.isInteger(mp) || mp < 0) {
      throw new Error(`suduku2/server: invalid maxPreparedLevel for ${tier}`);
    }
    if (typeof puzzlesRaw !== "object" || puzzlesRaw === null) {
      throw new Error(`suduku2/server: invalid puzzles for ${tier}`);
    }
    const puzzles: Record<number, PuzzleSpec> = {};
    for (const key of Object.keys(puzzlesRaw)) {
      const n = Number(key);
      const p = (puzzlesRaw as Record<string, unknown>)[key];
      if (!Number.isInteger(n) || n < 1 || !isPuzzleSpecWire(p)) {
        throw new Error(`suduku2/server: invalid puzzle entry ${tier}[${key}]`);
      }
      puzzles[n] = {
        seed: p.seed,
        givens: p.givens as number[][],
        difficultyScore: p.difficultyScore,
      };
    }
    out[tier] = { maxPreparedLevel: mp, puzzles: normalizePuzzlesKeys(puzzles) };
  }
  return out;
}

export function writeEndlessGlobalStateAtomic(dataDir: string, state: EndlessGlobalState): void {
  const file = endlessGlobalPath(dataDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload: EndlessGlobalFileV1 = { version: 1, state };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, file);
}

/**
 * 扫描 `users/*.json`，取每档 `endless.<tier>.clearedLevel` 的最大值。
 */
export function scanMaxClearedPerTier(dataDir: string): Record<DifficultyTier, number> {
  const max: Record<DifficultyTier, number> = {
    entry: 0,
    normal: 0,
    hard: 0,
    expert: 0,
  };
  const dir = path.join(dataDir, USERS_DIR);
  if (!fs.existsSync(dir)) {
    return max;
  }
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as unknown;
    } catch {
      continue;
    }
    if (typeof raw !== "object" || raw === null) continue;
    const endless = (raw as { endless?: unknown }).endless;
    if (typeof endless !== "object" || endless === null) continue;
    for (const tier of DIFFICULTY_TIERS) {
      const t = (endless as Record<string, unknown>)[tier];
      if (typeof t !== "object" || t === null) continue;
      const c = (t as { clearedLevel?: unknown }).clearedLevel;
      if (typeof c !== "number" || !Number.isInteger(c) || c < 0) continue;
      if (c > max[tier]) max[tier] = c;
    }
  }
  return max;
}

function recomputeMaxPreparedLevel(puzzles: Record<number, PuzzleSpec>): number {
  let m = 0;
  for (const k of Object.keys(puzzles)) {
    const n = Number(k);
    if (Number.isInteger(n) && n > m) m = n;
  }
  return m;
}

function generateOnePuzzleForTier(tier: DifficultyTier, level: number): PuzzleSpec | null {
  const maxAttempts = MAX_SEED_ATTEMPTS[tier];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = createRngFromSeedKey(seedKeyForAttempt(tier, level, attempt));
    const spec = generatePuzzle({ tier, rng, timeoutMs: GENERATE_TIMEOUT_MS });
    if (spec) {
      return mapGeneratorSpecToPublic(spec);
    }
  }
  if (tier === "expert") {
    console.warn(
      `suduku2/server: generatePuzzle exhausted ${maxAttempts} attempts for ${tier} level ${level} (timeout ${GENERATE_TIMEOUT_MS}ms each); pool gap may remain until next refresh`,
    );
  }
  return null;
}

/**
 * 读用户进度 → 计算每档关卡上界 → 补缺题目 → 写回 `global/endless.json`。
 * 返回最新全局状态（供 `getProgress` 使用）。
 */
export function refreshEndlessGlobalPool(dataDir: string): EndlessGlobalState {
  const maxCleared = scanMaxClearedPerTier(dataDir);
  let state = readEndlessGlobalState(dataDir);

  let dirty = false;
  for (const tier of DIFFICULTY_TIERS) {
    const needThrough = maxCleared[tier] + 1;
    if (needThrough < 1) continue;

    const tierState = state[tier];
    const puzzles = { ...tierState.puzzles };
    let tierDirty = false;

    for (let level = 1; level <= needThrough; level++) {
      const existing = puzzles[level];
      if (existing && isPuzzleSpecWire(existing)) {
        continue;
      }
      const generated = generateOnePuzzleForTier(tier, level);
      if (generated) {
        puzzles[level] = generated;
        tierDirty = true;
      }
    }

    const mp = recomputeMaxPreparedLevel(puzzles);
    if (tierDirty || mp !== tierState.maxPreparedLevel) {
      state = { ...state, [tier]: { maxPreparedLevel: mp, puzzles } };
      dirty = true;
    }
  }

  if (dirty) {
    writeEndlessGlobalStateAtomic(dataDir, state);
  }
  return state;
}
