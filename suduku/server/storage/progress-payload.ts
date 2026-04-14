import type { ProgressPayload } from "../progress-types";

export class ProgressPayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgressPayloadValidationError";
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function assertFiniteNonNegInt(name: string, n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new ProgressPayloadValidationError(`${name} must be a finite non-negative integer`);
  }
  return n;
}

function assertFiniteNonNegNumber(name: string, n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
    throw new ProgressPayloadValidationError(`${name} must be a finite non-negative number`);
  }
  return n;
}

function normalizeBestTimesMs(raw: unknown, ctx: string): Record<number, number> {
  if (!isPlainObject(raw)) {
    throw new ProgressPayloadValidationError(`${ctx}.bestTimesMs must be a plain object`);
  }
  const out: Record<number, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const level = assertFiniteNonNegInt(`${ctx}.bestTimesMs[${JSON.stringify(key)}]`, Number(key));
    out[level] = assertFiniteNonNegNumber(
      `${ctx}.bestTimesMs[${JSON.stringify(key)}]`,
      value,
    );
  }
  return out;
}

function normalizeEndless(data: unknown): ProgressPayload["endless"] {
  if (!isPlainObject(data)) {
    throw new ProgressPayloadValidationError("endless must be a plain object");
  }
  const out: ProgressPayload["endless"] = {};
  for (const [modeId, entry] of Object.entries(data)) {
    const ctx = `endless[${JSON.stringify(modeId)}]`;
    if (!isPlainObject(entry)) {
      throw new ProgressPayloadValidationError(`${ctx} must be a plain object`);
    }
    const currentLevel = assertFiniteNonNegInt(`${ctx}.currentLevel`, entry.currentLevel);
    const bestTimesMs = normalizeBestTimesMs(entry.bestTimesMs, ctx);
    out[modeId] = { currentLevel, bestTimesMs };
  }
  return out;
}

function normalizePractice(data: unknown): ProgressPayload["practice"] {
  if (!isPlainObject(data)) {
    throw new ProgressPayloadValidationError("practice must be a plain object");
  }
  const out: ProgressPayload["practice"] = {};
  for (const [modeId, entry] of Object.entries(data)) {
    const ctx = `practice[${JSON.stringify(modeId)}]`;
    if (!isPlainObject(entry)) {
      throw new ProgressPayloadValidationError(`${ctx} must be a plain object`);
    }
    if (typeof entry.unlocked !== "boolean") {
      throw new ProgressPayloadValidationError(`${ctx}.unlocked must be a boolean`);
    }
    const streak = assertFiniteNonNegInt(`${ctx}.streak`, entry.streak);
    let bestTimeMs: number | undefined;
    if (entry.bestTimeMs !== undefined) {
      bestTimeMs = assertFiniteNonNegNumber(`${ctx}.bestTimeMs`, entry.bestTimeMs);
    }
    out[modeId] =
      bestTimeMs === undefined ? { unlocked: entry.unlocked, streak } : { unlocked: entry.unlocked, streak, bestTimeMs };
  }
  return out;
}

function normalizeTutorial(data: unknown): ProgressPayload["tutorial"] {
  if (!isPlainObject(data)) {
    throw new ProgressPayloadValidationError("tutorial must be a plain object");
  }
  const out: ProgressPayload["tutorial"] = {};
  for (const [chapterId, done] of Object.entries(data)) {
    if (typeof done !== "boolean") {
      throw new ProgressPayloadValidationError(
        `tutorial[${JSON.stringify(chapterId)}] must be a boolean`,
      );
    }
    out[chapterId] = done;
  }
  return out;
}

/**
 * 校验并规范化未知输入为 {@link ProgressPayload}（含 `bestTimesMs` 的数字键）。
 *
 * @throws {ProgressPayloadValidationError} 结构或类型不符合约定时
 */
export function parseProgressPayload(data: unknown): ProgressPayload {
  if (!isPlainObject(data)) {
    throw new ProgressPayloadValidationError("ProgressPayload must be a plain object");
  }
  return {
    endless: normalizeEndless(data.endless),
    practice: normalizePractice(data.practice),
    tutorial: normalizeTutorial(data.tutorial),
  };
}
