import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { InvalidPasswordError, UsernameConflictError } from "./errors";

describe("register", () => {
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

  it("persists users-index.json with hashed password and stable userId", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-reg-"));
    process.env.SUDUKU2_DATA_DIR = tmp;
    const { register } = await import("./register");
    const { userId } = await register("Alice", "secret12", "Ali");
    expect(userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    const indexPath = path.join(tmp, "users-index.json");
    expect(existsSync(indexPath)).toBe(true);
    const raw = JSON.parse(readFileSync(indexPath, "utf8")) as {
      version: number;
      users: {
        alice: {
          userId: string;
          username: string;
          nickname?: string;
          password: { algo: string; saltB64: string; hashB64: string };
        };
      };
    };
    expect(raw.version).toBe(1);
    expect(raw.users.alice.userId).toBe(userId);
    expect(raw.users.alice.username).toBe("Alice");
    expect(raw.users.alice.nickname).toBe("Ali");
    expect(raw.users.alice.password.algo).toBe("scrypt");
    expect(raw.users.alice.password.saltB64.length).toBeGreaterThan(0);
    expect(raw.users.alice.password.hashB64.length).toBeGreaterThan(0);
  });

  it("rejects duplicate username with UsernameConflictError (case-insensitive)", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-reg-"));
    process.env.SUDUKU2_DATA_DIR = tmp;
    const { register } = await import("./register");
    await register("user1", "secret12");
    await expect(register("USER1", "othersecret12")).rejects.toBeInstanceOf(UsernameConflictError);
  });

  it("rejects password shorter than 6 characters", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-reg-"));
    process.env.SUDUKU2_DATA_DIR = tmp;
    const { register } = await import("./register");
    await expect(register("solo", "12345")).rejects.toBeInstanceOf(InvalidPasswordError);
  });
});
