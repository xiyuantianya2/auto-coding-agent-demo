import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/generator", () => ({
  generatePuzzle: () => ({
    seed: "mock",
    givens: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0)),
    difficultyScore: 11,
    requiredTechniques: [] as string[],
  }),
}));

describe("HTTP Route Handlers (Next.js app/api)", () => {
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

  it("register → login → GET/PATCH progress → export → import (smoke)", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-api-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { POST: registerPOST } = await import("@/app/api/auth/register/route");
    const { POST: loginPOST } = await import("@/app/api/auth/login/route");
    const { GET: progressGET, PATCH: progressPATCH } = await import("@/app/api/progress/route");
    const { GET: exportGET } = await import("@/app/api/progress/export/route");
    const { POST: importPOST } = await import("@/app/api/progress/import/route");

    const regRes = await registerPOST(
      new Request("http://test.local/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "apiUser", password: "secret12", nickname: "N" }),
      }),
    );
    expect(regRes.status).toBe(201);
    const regJson = (await regRes.json()) as { userId: string };
    expect(regJson.userId.length).toBeGreaterThan(0);

    const loginRes = await loginPOST(
      new Request("http://test.local/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "apiUser", password: "secret12" }),
      }),
    );
    expect(loginRes.status).toBe(200);
    const { token } = (await loginRes.json()) as { token: string };
    expect(token.length).toBeGreaterThan(0);

    const progRes = await progressGET(
      new Request("http://test.local/api/progress", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(progRes.status).toBe(200);
    const prog = (await progRes.json()) as {
      endless: { entry: { clearedLevel: number } };
      global: { entry: { puzzles: Record<number, { seed: string }> } };
    };
    expect(prog.endless.entry.clearedLevel).toBe(0);
    expect(prog.global.entry.puzzles[1]?.seed).toBe("mock");

    const patchRes = await progressPATCH(
      new Request("http://test.local/api/progress", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          techniques: { xwing: { unlocked: true } },
          endless: { normal: { clearedLevel: 2 } },
        }),
      }),
    );
    expect(patchRes.status).toBe(204);

    const exRes = await exportGET(
      new Request("http://test.local/api/progress/export", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(exRes.status).toBe(200);
    const exportedText = await exRes.text();
    expect(exportedText).toContain("suduku2-user-progress-v1");

    await progressPATCH(
      new Request("http://test.local/api/progress", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ techniques: { xwing: { unlocked: false } } }),
      }),
    );

    const imRes = await importPOST(
      new Request("http://test.local/api/progress/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ json: exportedText }),
      }),
    );
    expect(imRes.status).toBe(204);

    const after = await progressGET(
      new Request("http://test.local/api/progress", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const afterJson = (await after.json()) as { techniques: { xwing?: { unlocked: boolean } } };
    expect(afterJson.techniques.xwing).toEqual({ unlocked: true });
  });

  it("returns 401 when Authorization is missing on protected routes", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-api-401-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { GET: progressGET } = await import("@/app/api/progress/route");

    const res = await progressGET(new Request("http://test.local/api/progress"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 409 on duplicate register", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-api-409-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { POST: registerPOST } = await import("@/app/api/auth/register/route");

    const first = await registerPOST(
      new Request("http://test.local/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "dup", password: "secret12" }),
      }),
    );
    expect(first.status).toBe(201);

    const second = await registerPOST(
      new Request("http://test.local/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "DUP", password: "othersecret12" }),
      }),
    );
    expect(second.status).toBe(409);
    const err = (await second.json()) as { error: { code: string } };
    expect(err.error.code).toBe("USERNAME_CONFLICT");
  });
});
