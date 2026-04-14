/**
 * 将 {@link TechniqueId}（kebab-case 字符串）映射为供文案 / i18n 查找的稳定 `messageKey`。
 * 不改变任何提示几何信息，仅用于展示层键名。
 */

import type { KnownTechniqueId, TechniqueId } from "@/lib/solver";
import { TECHNIQUE_IDS } from "@/lib/solver";

/** 与 curriculum / UI 共享的前缀；完整 key 为 `${前缀}${TechniqueId}`。 */
export const HINT_TECHNIQUE_MESSAGE_KEY_PREFIX = "hint.technique." as const;

const KNOWN_IDS = new Set<string>(Object.values(TECHNIQUE_IDS));

function buildMessageKeys(): Record<KnownTechniqueId, string> {
  const out = {} as Record<KnownTechniqueId, string>;
  for (const id of Object.values(TECHNIQUE_IDS) as KnownTechniqueId[]) {
    out[id] = `${HINT_TECHNIQUE_MESSAGE_KEY_PREFIX}${id}`;
  }
  return out;
}

/** 已知技法 id → messageKey（与 {@link getHintMessageKey} 一致）。 */
export const HINT_MESSAGE_KEYS: Record<KnownTechniqueId, string> =
  Object.freeze(buildMessageKeys());

/**
 * 由技巧 id 得到文案查找键。
 *
 * - 已知 {@link TECHNIQUE_IDS} 中的 id：返回 `hint.technique.<kebab-id>`，与 id 一一可逆（见 {@link hintMessageKeyToTechniqueId}）。
 * - 引擎将来新增、但本表尚未收录的 `TechniqueId` 字符串：返回 `undefined`，调用方可用前缀自行拼接或走通用回退文案（此处不猜测，避免错误键）。
 */
export function getHintMessageKey(technique: TechniqueId): string | undefined {
  if (KNOWN_IDS.has(technique)) {
    return `${HINT_TECHNIQUE_MESSAGE_KEY_PREFIX}${technique}`;
  }
  return undefined;
}

/**
 * 将 `messageKey` 还原为 {@link TechniqueId}；仅当 key 对应该前缀且后缀为已知技法 id 时成功。
 */
export function hintMessageKeyToTechniqueId(key: string): TechniqueId | undefined {
  if (!key.startsWith(HINT_TECHNIQUE_MESSAGE_KEY_PREFIX)) {
    return undefined;
  }
  const suffix = key.slice(HINT_TECHNIQUE_MESSAGE_KEY_PREFIX.length);
  if (KNOWN_IDS.has(suffix)) {
    return suffix as TechniqueId;
  }
  return undefined;
}
