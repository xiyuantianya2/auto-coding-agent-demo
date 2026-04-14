import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  InvalidTokenError,
  UnknownUserError,
  WrongPasswordError,
} from "./errors";

describe("login & getUserIdFromToken", () => {
  const originalEnv = process.env.SUDUKU2_DATA_DIR;
  let tmp: string | undefined;

  afterEach(() => {
    if (tmp) {
      rmSync(tmp, { recursive: true, force: true });
      tmp = undefined;
    }
    if (originalEnv === undefined) {
      delete process.env.SUDUKU2_DATA_DIR;
    } else {
      process.env.SUDUKU2_DATA_DIR = originalEnv;
    }
  });

  it("returns token and persists session; getUserIdFromToken resolves userId", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-login-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login, getUserIdFromToken } = await import("./login");

    const { userId } = await register("bob", "secret12");
    const { token } = await login("bob", "secret12");

    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(getUserIdFromToken(token)).toBe(userId);

    const sessionsPath = path.join(tmp, "sessions.json");
    expect(existsSync(sessionsPath)).toBe(true);
    const raw = JSON.parse(readFileSync(sessionsPath, "utf8")) as {
      version: number;
      sessions: Record<string, { userId: string; createdAt: string }>;
    };
    expect(raw.version).toBe(1);
    expect(raw.sessions[token].userId).toBe(userId);
    expect(typeof raw.sessions[token].createdAt).toBe("string");
  });

  it("rejects wrong password with WrongPasswordError", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-login-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login } = await import("./login");

    await register("carol", "correctpass12");
    await expect(login("carol", "wrongpass12")).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it("rejects unknown user with UnknownUserError", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-login-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { login } = await import("./login");

    await expect(login("nobody", "secret12")).rejects.toBeInstanceOf(UnknownUserError);
  });

  it("getUserIdFromToken rejects unknown or malformed token", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-login-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login, getUserIdFromToken } = await import("./login");

    await register("dave", "secret12");
    const { token } = await login("dave", "secret12");

    expect(() => getUserIdFromToken("not-a-valid-token")).toThrow(InvalidTokenError);
    expect(() => getUserIdFromToken("")).toThrow(InvalidTokenError);
    // tamper with last char — still invalid if not in map
    const tampered =
      token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    if (tampered !== token) {
      expect(() => getUserIdFromToken(tampered)).toThrow(InvalidTokenError);
    }
  });
});
