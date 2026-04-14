import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test, expect } from "@playwright/test";
import { verifyUniqueSolution } from "@/lib/generator";
import {
  LOGIN_FAILED_MESSAGE,
  LoginFailedError,
  SUDUKU_SESSION_SECRET_ENV,
  UsernameTakenError,
  createEmptyProgressPayload,
  loadProgress,
  login,
  registerUser,
  requestNextPuzzle,
  saveProgress,
  validateToken,
  type ProgressPayload,
} from "@/server";
import { USERNAME_INDEX_FILE } from "@/server/storage/paths";

let e2eDataRoot: string;
let prevDataDir: string | undefined;
let prevSessionSecret: string | undefined;

test.beforeAll(() => {
  prevDataDir = process.env.SUDUKU_DATA_DIR;
  prevSessionSecret = process.env[SUDUKU_SESSION_SECRET_ENV];
  e2eDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "suduku-e2e-server-"));
  process.env.SUDUKU_DATA_DIR = e2eDataRoot;
  process.env[SUDUKU_SESSION_SECRET_ENV] = "e2e-playwright-session-secret-key";
});

test.afterAll(() => {
  if (prevDataDir === undefined) {
    delete process.env.SUDUKU_DATA_DIR;
  } else {
    process.env.SUDUKU_DATA_DIR = prevDataDir;
  }
  if (prevSessionSecret === undefined) {
    delete process.env[SUDUKU_SESSION_SECRET_ENV];
  } else {
    process.env[SUDUKU_SESSION_SECRET_ENV] = prevSessionSecret;
  }
  fs.rmSync(e2eDataRoot, { recursive: true, force: true });
});

test.describe("Suduku server-api (Node-side)", () => {
  test("createEmptyProgressPayload returns empty records", () => {
    const empty = createEmptyProgressPayload();
    expect(empty.endless).toEqual({});
    expect(empty.practice).toEqual({});
    expect(empty.tutorial).toEqual({});
  });

  test("loadProgress returns empty progress when no progress.json", async () => {
    await expect(loadProgress("test-user")).resolves.toEqual(
      createEmptyProgressPayload(),
    );
  });

  test("saveProgress merges twice: keeps better bestTimesMs and keeps practice/tutorial", async () => {
    const userId = "progress-merge-e2e";
    const first: ProgressPayload = {
      endless: {
        normal: {
          currentLevel: 4,
          bestTimesMs: { 0: 7000, 1: 8000 },
        },
      },
      practice: { "e2e-mode": { unlocked: true, streak: 3, bestTimeMs: 4000 } },
      tutorial: { e2eChap: true },
    };
    await saveProgress(userId, first);

    const patch: ProgressPayload = {
      endless: {
        normal: {
          currentLevel: 2,
          bestTimesMs: { 0: 9000, 1: 7500 },
        },
      },
      practice: {},
      tutorial: {},
    };
    await saveProgress(userId, patch);

    await expect(loadProgress(userId)).resolves.toEqual({
      endless: {
        normal: {
          currentLevel: 4,
          bestTimesMs: { 0: 7000, 1: 7500 },
        },
      },
      practice: { "e2e-mode": { unlocked: true, streak: 3, bestTimeMs: 4000 } },
      tutorial: { e2eChap: true },
    });
  });

  test("registerUser creates index and credentials JSON; duplicate username fails", async () => {
    const hash = "e2e-credential-material";
    const userId = await registerUser("e2e-user", hash);

    const indexPath = path.join(e2eDataRoot, USERNAME_INDEX_FILE);
    expect(fs.existsSync(indexPath)).toBe(true);
    const idx = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
      usernameToUserId: Record<string, string>;
    };
    expect(idx.usernameToUserId["e2e-user"]).toBe(userId);

    await expect(registerUser("e2e-user", "other")).rejects.toBeInstanceOf(
      UsernameTakenError,
    );
  });

  test("login succeeds with matching material and rejects wrong password", async () => {
    const secret = "matching-credential-string";
    const userId = await registerUser("login-user", secret);
    const { token } = await login("login-user", secret);
    expect(token.startsWith("suduku-session-v1.")).toBe(true);
    expect(validateToken(token)).toBe(userId);

    await expect(login("login-user", "nope")).rejects.toBeInstanceOf(LoginFailedError);
    await expect(login("login-user", "nope")).rejects.toMatchObject({
      message: LOGIN_FAILED_MESSAGE,
    });
  });

  test("requestNextPuzzle returns canonical seed, givens, and a uniquely solvable grid", async () => {
    const spec = await requestNextPuzzle("e2e-puzzle-user", "easy");
    expect(spec.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(spec.givens).toHaveLength(9);
    expect(spec.givens.every((row) => row.length === 9)).toBe(true);
    expect(typeof spec.difficultyScore).toBe("number");
    expect(Array.isArray(spec.requiredTechniques)).toBe(true);
    expect(verifyUniqueSolution(spec.givens)).toBe(true);
  });

  test("requestNextPuzzle smoke: easy and normal tiers (full generator pipeline)", async () => {
    const userId = "e2e-tier-smoke";
    for (const tier of ["easy", "normal"] as const) {
      const spec = await requestNextPuzzle(userId, tier);
      expect(spec.seed).toMatch(/^[0-9a-f]{32}$/);
      expect(verifyUniqueSolution(spec.givens)).toBe(true);
    }
  });
});
