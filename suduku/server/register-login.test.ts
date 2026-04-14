import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LOGIN_FAILED_MESSAGE,
  LoginFailedError,
  UsernameTakenError,
  login,
  registerUser,
} from "./register-login";
import { SUDUKU_DATA_DIR_ENV } from "./storage/data-root";
import { USERNAME_INDEX_FILE, getUserCredentialsPath, getUserDir } from "./storage/paths";

function tmpDataRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "suduku-auth-"));
}

describe("registerUser / login", () => {
  let prevDataDir: string | undefined;
  let dataRoot: string;

  beforeEach(() => {
    prevDataDir = process.env[SUDUKU_DATA_DIR_ENV];
    dataRoot = tmpDataRoot();
    process.env[SUDUKU_DATA_DIR_ENV] = dataRoot;
  });

  afterEach(() => {
    if (prevDataDir === undefined) {
      delete process.env[SUDUKU_DATA_DIR_ENV];
    } else {
      process.env[SUDUKU_DATA_DIR_ENV] = prevDataDir;
    }
    fs.rmSync(dataRoot, { recursive: true, force: true });
  });

  it("registers successfully and persists expected JSON structure", async () => {
    const hash = "sha256-hex-example-deadbeefcafe";
    const userId = await registerUser("alice", hash);

    expect(userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const indexPath = path.join(dataRoot, USERNAME_INDEX_FILE);
    const indexRaw = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
      v: number;
      usernameToUserId: Record<string, string>;
    };
    expect(indexRaw.v).toBe(1);
    expect(indexRaw.usernameToUserId.alice).toBe(userId);

    const credPath = getUserCredentialsPath(dataRoot, userId);
    const cred = JSON.parse(fs.readFileSync(credPath, "utf8")) as {
      v: number;
      passwordHash: string;
    };
    expect(cred.v).toBe(1);
    expect(cred.passwordHash).toBe(hash);
  });

  it("fails on duplicate username", async () => {
    await registerUser("bob", "h1");
    await expect(registerUser("bob", "h2")).rejects.toBeInstanceOf(UsernameTakenError);
    await expect(registerUser("  bob  ", "h2")).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it("fails login with wrong password", async () => {
    await registerUser("carol", "correct-material");
    await expect(login("carol", "wrong-material")).rejects.toBeInstanceOf(LoginFailedError);
    await expect(login("carol", "wrong-material")).rejects.toMatchObject({
      message: LOGIN_FAILED_MESSAGE,
    });
  });

  it("logs in successfully with matching credential material", async () => {
    const material = "client-side-agreed-secret-string";
    await registerUser("dave", material);
    const { token } = await login("  dave  ", material);
    expect(token.length).toBeGreaterThan(10);
  });

  it("does not leak user existence on failed login", async () => {
    await expect(login("nobody", "x")).rejects.toMatchObject({
      message: LOGIN_FAILED_MESSAGE,
    });
    await registerUser("eve", "secret");
    await expect(login("eve", "bad")).rejects.toMatchObject({
      message: LOGIN_FAILED_MESSAGE,
    });
  });

  it("creates users/<userId>/ directory for new accounts", async () => {
    const id = await registerUser("frank", "pw");
    expect(fs.existsSync(getUserDir(dataRoot, id))).toBe(true);
  });
});
