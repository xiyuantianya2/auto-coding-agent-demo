import type { ProgressPayload } from "../progress-types";

/**
 * `ProgressPayload` **读-合并-写** 规则（任务 5）。
 *
 * 以 `stored`（磁盘已有进度）为基底，将 `incoming`（本次提交）按模式/章节 **合并**，避免客户端 PATCH 省略整段（如 `practice: {}`）或只改某一难度线时，误删其它键上的数据。
 *
 * ## endless[modeId]
 *
 * - **仅出现在 `stored`**：原样保留。
 * - **仅出现在 `incoming`**：采用 `incoming` 中该条（已通过 {@link parseProgressPayload} 的同形校验）。
 * - **两侧都有**：
 *   - `currentLevel`：取 **较大值**，避免旧客户端或竞态把关卡回退。
 *   - `bestTimesMs`：对每个关卡号（非负整数键），若仅一侧有则沿用该侧；若两侧都有则取 **较小毫秒数**（更快更优）。
 *
 * ## practice[modeId]
 *
 * - 键级规则与 `endless` 相同（只更新 `incoming` 中出现的 modeId，其余保留）。
 * - 同一 modeId 合并时：
 *   - `unlocked`：**逻辑或**（任一为 `true` 则保持已解锁）。
 *   - `streak`：取 **较大值**（避免合并时误丢较高连击记录）。
 *   - `bestTimeMs`：若两侧均有则取 **较小**；仅一侧有则沿用该侧。
 *
 * ## tutorial[chapterId]
 *
 * - 键级规则同上。
 * - 同一章节：**逻辑或**（任一标记完成则保持完成）。
 *
 * ## 冲突处理
 *
 * 对同一关卡/模式出现不一致数据时，按上表「取更优 / 更宽松」消解；本函数假定 `stored` 与 `incoming` 均已通过 `ProgressPayload` 形状校验。
 */
export function mergeProgressPayload(
  stored: ProgressPayload,
  incoming: ProgressPayload,
): ProgressPayload {
  const endless: ProgressPayload["endless"] = { ...stored.endless };
  for (const modeId of Object.keys(incoming.endless)) {
    const inc = incoming.endless[modeId];
    const prev = stored.endless[modeId];
    endless[modeId] =
      prev === undefined
        ? { currentLevel: inc.currentLevel, bestTimesMs: { ...inc.bestTimesMs } }
        : mergeEndlessEntry(prev, inc);
  }

  const practice: ProgressPayload["practice"] = { ...stored.practice };
  for (const modeId of Object.keys(incoming.practice)) {
    const inc = incoming.practice[modeId];
    const prev = stored.practice[modeId];
    practice[modeId] =
      prev === undefined
        ? clonePracticeEntry(inc)
        : mergePracticeEntry(prev, inc);
  }

  const tutorial: ProgressPayload["tutorial"] = { ...stored.tutorial };
  for (const chapterId of Object.keys(incoming.tutorial)) {
    tutorial[chapterId] =
      (stored.tutorial[chapterId] ?? false) || incoming.tutorial[chapterId];
  }

  return { endless, practice, tutorial };
}

function mergeEndlessEntry(
  prev: ProgressPayload["endless"][string],
  inc: ProgressPayload["endless"][string],
): ProgressPayload["endless"][string] {
  const currentLevel = Math.max(prev.currentLevel, inc.currentLevel);
  const levelKeys = new Set([
    ...Object.keys(prev.bestTimesMs),
    ...Object.keys(inc.bestTimesMs),
  ]);
  const bestTimesMs: Record<number, number> = {};
  for (const key of levelKeys) {
    const level = Number(key);
    const a = prev.bestTimesMs[level];
    const b = inc.bestTimesMs[level];
    if (a === undefined) {
      bestTimesMs[level] = b as number;
    } else if (b === undefined) {
      bestTimesMs[level] = a;
    } else {
      bestTimesMs[level] = Math.min(a, b);
    }
  }
  return { currentLevel, bestTimesMs };
}

function mergePracticeEntry(
  prev: ProgressPayload["practice"][string],
  inc: ProgressPayload["practice"][string],
): ProgressPayload["practice"][string] {
  const unlocked = prev.unlocked || inc.unlocked;
  const streak = Math.max(prev.streak, inc.streak);
  let bestTimeMs: number | undefined;
  if (prev.bestTimeMs !== undefined && inc.bestTimeMs !== undefined) {
    bestTimeMs = Math.min(prev.bestTimeMs, inc.bestTimeMs);
  } else if (prev.bestTimeMs !== undefined) {
    bestTimeMs = prev.bestTimeMs;
  } else if (inc.bestTimeMs !== undefined) {
    bestTimeMs = inc.bestTimeMs;
  }
  const out: ProgressPayload["practice"][string] = { unlocked, streak };
  if (bestTimeMs !== undefined) {
    out.bestTimeMs = bestTimeMs;
  }
  return out;
}

function clonePracticeEntry(
  entry: ProgressPayload["practice"][string],
): ProgressPayload["practice"][string] {
  const base = { unlocked: entry.unlocked, streak: entry.streak };
  return entry.bestTimeMs === undefined
    ? base
    : { ...base, bestTimeMs: entry.bestTimeMs };
}
