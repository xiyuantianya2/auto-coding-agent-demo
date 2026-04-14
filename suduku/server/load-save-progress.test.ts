import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createEmptyProgressPayload, type ProgressPayload } from "./progress-types";
import { loadProgress, mergeProgressPayload, saveProgress } from "./index";
import { SUDUKU_DATA_DIR_ENV } from "./storage/data-root";
import { getUserProgressPath } from "./storage/paths";

describe("mergeProgressPayload", () => {
  it("merges bestTimesMs per level with minimum (faster) time", () => {
    const stored: ProgressPayload = {
      endless: {
        easy: {
          currentLevel: 2,
          bestTimesMs: { 0: 5000, 1: 8000 },
        },
      },
      practice: {},
      tutorial: {},
    };
    const incoming: ProgressPayload = {
      endless: {
        easy: {
          currentLevel: 1,
          bestTimesMs: { 0: 9000, 1: 3000 },
        },
      },
      practice: {},
      tutorial: {},
    };
    const merged = mergeProgressPayload(stored, incoming);
    expect(merged.endless.easy.currentLevel).toBe(2);
    expect(merged.endless.easy.bestTimesMs[0]).toBe(5000);
    expect(merged.endless.easy.bestTimesMs[1]).toBe(3000);
  });

  it("does not drop tutorial or practice keys when incoming omits them (empty records)", () => {
    const stored: ProgressPayload = {
      endless: {},
      practice: { "mode-a": { unlocked: true, streak: 4, bestTimeMs: 1200 } },
      tutorial: { chap1: true, chap2: false },
    };
    const incoming: ProgressPayload = {
      endless: {
        easy: { currentLevel: 1, bestTimesMs: {} },
      },
      practice: {},
      tutorial: {},
    };
    const merged = mergeProgressPayload(stored, incoming);
    expect(merged.practice["mode-a"]).toEqual({
      unlocked: true,
      streak: 4,
      bestTimeMs: 1200,
    });
    expect(merged.tutorial).toEqual({ chap1: true, chap2: false });
    expect(merged.endless.easy).toEqual({ currentLevel: 1, bestTimesMs: {} });
  });

  it("OR-merges tutorial completion and practice unlocked", () => {
    const stored: ProgressPayload = {
      endless: {},
      practice: { m: { unlocked: false, streak: 2 } },
      tutorial: { c: false },
    };
    const incoming: ProgressPayload = {
      endless: {},
      practice: { m: { unlocked: true, streak: 0 } },
      tutorial: { c: true },
    };
    const merged = mergeProgressPayload(stored, incoming);
    expect(merged.practice.m.unlocked).toBe(true);
    expect(merged.practice.m.streak).toBe(2);
    expect(merged.tutorial.c).toBe(true);
  });
});

describe("loadProgress / saveProgress (merged persistence)", () => {
  it("two saves keep better bestTimesMs and do not clear tutorial/practice", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "suduku-load-save-"));
    const prev = process.env[SUDUKU_DATA_DIR_ENV];
    process.env[SUDUKU_DATA_DIR_ENV] = root;
    const userId = "merge-user-1";
    try {
      const first: ProgressPayload = {
        endless: {
          hard: {
            currentLevel: 3,
            bestTimesMs: { 0: 10000, 1: 12000 },
          },
        },
        practice: {
          "practice-mode-x": { unlocked: true, streak: 5, bestTimeMs: 6000 },
        },
        tutorial: { chapterA: true, chapterB: false },
      };
      await saveProgress(userId, first);

      const second: ProgressPayload = {
        endless: {
          hard: {
            currentLevel: 2,
            bestTimesMs: { 0: 15000, 1: 9000 },
          },
        },
        practice: {},
        tutorial: {},
      };
      await saveProgress(userId, second);

      const loaded = await loadProgress(userId);
      expect(loaded.endless.hard.currentLevel).toBe(3);
      expect(loaded.endless.hard.bestTimesMs[0]).toBe(10000);
      expect(loaded.endless.hard.bestTimesMs[1]).toBe(9000);
      expect(loaded.practice["practice-mode-x"]).toEqual({
        unlocked: true,
        streak: 5,
        bestTimeMs: 6000,
      });
      expect(loaded.tutorial).toEqual({ chapterA: true, chapterB: false });

      const filePath = getUserProgressPath(root, userId);
      expect(fs.existsSync(filePath)).toBe(true);
    } finally {
      if (prev === undefined) {
        delete process.env[SUDUKU_DATA_DIR_ENV];
      } else {
        process.env[SUDUKU_DATA_DIR_ENV] = prev;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("loadProgress returns empty default when file missing", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "suduku-load-empty-"));
    const prev = process.env[SUDUKU_DATA_DIR_ENV];
    process.env[SUDUKU_DATA_DIR_ENV] = root;
    try {
      await expect(loadProgress("no-file-yet")).resolves.toEqual(
        createEmptyProgressPayload(),
      );
    } finally {
      if (prev === undefined) {
        delete process.env[SUDUKU_DATA_DIR_ENV];
      } else {
        process.env[SUDUKU_DATA_DIR_ENV] = prev;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
