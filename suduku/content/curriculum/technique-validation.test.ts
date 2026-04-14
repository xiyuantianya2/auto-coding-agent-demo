import { describe, expect, it } from "vitest";

import { TECHNIQUE_IDS } from "@/lib/solver";

import type { CurriculumNode } from "./types";
import {
  isKnownTechniqueId,
  listKnownTechniqueIds,
  validateCurriculumTechniqueIds,
} from "./technique-validation";

describe("validateCurriculumTechniqueIds", () => {
  it("passes when all technique ids come from TECHNIQUE_IDS", () => {
    const nodes: CurriculumNode[] = [
      {
        id: "ch-1",
        tier: "low",
        techniqueIds: [
          TECHNIQUE_IDS.NAKED_SINGLE,
          TECHNIQUE_IDS.HIDDEN_SINGLE,
          TECHNIQUE_IDS.NAKED_PAIR,
          TECHNIQUE_IDS.HIDDEN_PAIR,
          TECHNIQUE_IDS.POINTING,
          TECHNIQUE_IDS.CLAIMING,
          TECHNIQUE_IDS.X_WING,
          TECHNIQUE_IDS.SWORDFISH,
          TECHNIQUE_IDS.SKYSCRAPER,
          TECHNIQUE_IDS.XY_WING,
        ],
      },
    ];
    expect(validateCurriculumTechniqueIds(nodes)).toEqual({ ok: true });
  });

  it("returns structured errors for unknown technique ids (no throw)", () => {
    const nodes: CurriculumNode[] = [
      {
        id: "bad-chapter",
        tier: "mid",
        techniqueIds: [TECHNIQUE_IDS.POINTING, "not-a-known-technique"],
      },
    ];
    const r = validateCurriculumTechniqueIds(nodes);
    expect(r).toEqual({
      ok: false,
      errors: [
        { chapterId: "bad-chapter", techniqueId: "not-a-known-technique" },
      ],
    });
  });

  it("accepts an empty curriculum tree", () => {
    expect(validateCurriculumTechniqueIds([])).toEqual({ ok: true });
  });
});

describe("isKnownTechniqueId", () => {
  it("is true for every TECHNIQUE_IDS value and false for arbitrary strings", () => {
    for (const id of Object.values(TECHNIQUE_IDS)) {
      expect(isKnownTechniqueId(id)).toBe(true);
    }
    expect(isKnownTechniqueId("not-in-registry")).toBe(false);
  });
});

describe("listKnownTechniqueIds", () => {
  it("lists the same ids as Object.values(TECHNIQUE_IDS), each once", () => {
    const listed = listKnownTechniqueIds();
    const fromRegistry = Object.values(TECHNIQUE_IDS).sort();
    expect([...listed].sort()).toEqual(fromRegistry);
    expect(new Set(listed).size).toBe(listed.length);
  });
});
