import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test, expect } from "@playwright/test";
import {
  LOGIN_FAILED_MESSAGE,
  LoginFailedError,
  SERVER_API_NOT_IMPLEMENTED,
  UsernameTakenError,
  createEmptyProgressPayload,
  loadProgress,
  login,
  registerUser,
  saveProgress,
} from "@/server";
import { USERNAME_INDEX_FILE } from "@/server/storage/paths";

let e2eDataRoot: string;
let prevDataDir: string | undefined;

test.beforeAll(() => {
  prevDataDir = process.env.SUDUKU_DATA_DIR;
  e2eDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "suduku-e2e-server-"));
  process.env.SUDUKU_DATA_DIR = e2eDataRoot;
});

test.afterAll(() => {
  if (prevDataDir === undefined) {
    delete process.env.SUDUKU_DATA_DIR;
  } else {
    process.env.SUDUKU_DATA_DIR = prevDataDir;
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

  test("loadProgress returns empty progress placeholder", async () => {
    await expect(loadProgress("test-user")).resolves.toEqual(
      createEmptyProgressPayload(),
    );
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
    await registerUser("login-user", secret);
    const { token } = await login("login-user", secret);
    expect(token.length).toBeGreaterThan(8);

    await expect(login("login-user", "nope")).rejects.toBeInstanceOf(LoginFailedError);
    await expect(login("login-user", "nope")).rejects.toMatchObject({
      message: LOGIN_FAILED_MESSAGE,
    });
  });

  test("saveProgress still rejects until implemented", async () => {
    await expect(
      saveProgress("u", createEmptyProgressPayload()),
    ).rejects.toThrow(SERVER_API_NOT_IMPLEMENTED);
  });
});
