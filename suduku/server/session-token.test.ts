import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SUDUKU_SESSION_SECRET_ENV,
  SUDUKU_SESSION_TTL_MS_ENV,
  createSessionToken,
  validateToken,
} from "./session-token";

describe("session token (HMAC)", () => {
  let prevSecret: string | undefined;
  let prevTtl: string | undefined;

  beforeEach(() => {
    prevSecret = process.env[SUDUKU_SESSION_SECRET_ENV];
    prevTtl = process.env[SUDUKU_SESSION_TTL_MS_ENV];
    process.env[SUDUKU_SESSION_SECRET_ENV] = "unit-test-session-secret-must-be-long";
    delete process.env[SUDUKU_SESSION_TTL_MS_ENV];
  });

  afterEach(() => {
    vi.useRealTimers();
    if (prevSecret === undefined) {
      delete process.env[SUDUKU_SESSION_SECRET_ENV];
    } else {
      process.env[SUDUKU_SESSION_SECRET_ENV] = prevSecret;
    }
    if (prevTtl === undefined) {
      delete process.env[SUDUKU_SESSION_TTL_MS_ENV];
    } else {
      process.env[SUDUKU_SESSION_TTL_MS_ENV] = prevTtl;
    }
  });

  it("validateToken returns the same userId for a freshly issued token", () => {
    const token = createSessionToken("user-uuid-123");
    expect(validateToken(token)).toBe("user-uuid-123");
  });

  it("returns null when token is tampered (uid changed)", () => {
    const token = createSessionToken("alice");
    const parts = token.split(".");
    expect(parts.length).toBe(3);
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      uid: string;
    };
    payload.uid = "eve";
    const tampered = `${parts[0]}.${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}.${parts[2]}`;
    expect(validateToken(tampered)).toBe(null);
  });

  it("returns null when signature segment is wrong", () => {
    const token = createSessionToken("bob");
    const parts = token.split(".");
    const wrongSig = Buffer.from("not-the-hmac").toString("base64url");
    expect(validateToken(`${parts[0]}.${parts[1]}.${wrongSig}`)).toBe(null);
  });

  it("returns null when token is expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));
    const token = createSessionToken("carol");
    vi.setSystemTime(new Date("2025-06-10T12:00:00.000Z"));
    expect(validateToken(token)).toBe(null);
  });

  it("returns null for unknown prefix or garbage", () => {
    expect(validateToken("")).toBe(null);
    expect(validateToken("nope")).toBe(null);
    expect(validateToken("suduku-session-v2.a.b")).toBe(null);
  });

  it("returns null when secret is not configured", () => {
    const token = createSessionToken("dave");
    delete process.env[SUDUKU_SESSION_SECRET_ENV];
    expect(validateToken(token)).toBe(null);
  });

  it("createSessionToken throws if secret missing", () => {
    delete process.env[SUDUKU_SESSION_SECRET_ENV];
    expect(() => createSessionToken("x")).toThrow(SUDUKU_SESSION_SECRET_ENV);
  });

  it("respects SUDUKU_SESSION_TTL_MS for expiry", () => {
    process.env[SUDUKU_SESSION_TTL_MS_ENV] = "1000";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    const token = createSessionToken("ttl-user");
    vi.setSystemTime(new Date("2025-01-01T00:00:01.500Z"));
    expect(validateToken(token)).toBe(null);
  });
});
