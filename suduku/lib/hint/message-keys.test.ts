import { describe, expect, it } from "vitest";
import { TECHNIQUE_IDS } from "@/lib/solver";
import {
  HINT_MESSAGE_KEYS,
  HINT_TECHNIQUE_MESSAGE_KEY_PREFIX,
  getHintMessageKey,
  hintMessageKeyToTechniqueId,
} from "./message-keys";

describe("hint message keys ↔ TechniqueId", () => {
  it("assigns a non-empty messageKey to every TECHNIQUE_IDS entry", () => {
    for (const id of Object.values(TECHNIQUE_IDS)) {
      const key = getHintMessageKey(id);
      expect(key).toBeTruthy();
      expect(key!.length).toBeGreaterThan(0);
      expect(HINT_MESSAGE_KEYS[id]).toBe(key);
    }
  });

  it("keeps messageKey reversible with kebab-case TechniqueId", () => {
    for (const id of Object.values(TECHNIQUE_IDS)) {
      const key = getHintMessageKey(id)!;
      expect(key.startsWith(HINT_TECHNIQUE_MESSAGE_KEY_PREFIX)).toBe(true);
      expect(key.slice(HINT_TECHNIQUE_MESSAGE_KEY_PREFIX.length)).toBe(id);
      expect(hintMessageKeyToTechniqueId(key)).toBe(id);
    }
  });

  it("returns undefined for unknown technique strings (no fallback guess)", () => {
    expect(getHintMessageKey("future-technique-not-in-table")).toBeUndefined();
  });

  it("does not treat arbitrary prefixed strings as known techniques", () => {
    expect(
      hintMessageKeyToTechniqueId(`${HINT_TECHNIQUE_MESSAGE_KEY_PREFIX}not-listed`),
    ).toBeUndefined();
  });
});
