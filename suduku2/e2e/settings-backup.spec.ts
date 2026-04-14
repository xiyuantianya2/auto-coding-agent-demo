import fs from "node:fs/promises";
import path from "node:path";

import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

/** 与任务约定一致：单次导出或导入应在合理时间内完成（通常 < 5s） */
const BACKUP_OP_MAX_MS = 5000;

test("主题切换：html 上出现 dark class", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-settings-section")).toBeVisible();
  await page.getByTestId("settings-theme-select").selectOption("light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByTestId("settings-theme-select").selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("候选数高对比：html 上出现 hc-candidates class", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("settings-hc-candidates").setChecked(true);
  await expect(page.locator("html")).toHaveClass(/hc-candidates/);
  await page.getByTestId("settings-hc-candidates").setChecked(false);
  await expect(page.locator("html")).not.toHaveClass(/hc-candidates/);
});

test("点击导出进度：提示已开始且单次在合理时间内完成", async ({ page, request }) => {
  const { token } = await apiRegisterAndLogin(request);
  await injectAuth(page, token);
  await page.goto("/");
  const t0 = Date.now();
  await page.getByTestId("progress-export-button").click();
  await expect(page.getByTestId("progress-backup-message")).toContainText("导出已开始", {
    timeout: 10_000,
  });
  expect(Date.now() - t0).toBeLessThan(BACKUP_OP_MAX_MS);
});

test("导出再导入 round-trip：endless/techniques 与导出快照一致（<5s/步）", async ({
  page,
  request,
}) => {
  const { token } = await apiRegisterAndLogin(request);

  const patchRes = await request.patch("/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      endless: { entry: { clearedLevel: 7 }, normal: { clearedLevel: 2 } },
      techniques: { "x-wing": { unlocked: true } },
    },
  });
  expect(patchRes.status()).toBe(204);

  const outDir = path.join(process.cwd(), "test-results");
  await fs.mkdir(outDir, { recursive: true });
  const tmpPath = path.join(outDir, `e2e-roundtrip-${Date.now()}.json`);

  /** 与首页「导出进度 JSON」按钮相同的数据源（`fetchProgressExportJson` → GET /api/progress/export） */
  const exportStarted = Date.now();
  const exportRes = await request.get("/api/progress/export", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(exportRes.ok()).toBe(true);
  const raw = await exportRes.text();
  expect(Date.now() - exportStarted).toBeLessThan(BACKUP_OP_MAX_MS);
  await fs.writeFile(tmpPath, raw, "utf8");

  await injectAuth(page, token);
  await page.goto("/");
  const envelope = JSON.parse(raw) as {
    exportVersion: number;
    format: string;
    progress: {
      version: number;
      endless: Record<string, { clearedLevel: number }>;
      techniques: Record<string, { unlocked?: boolean } | undefined>;
    };
  };
  expect(envelope.exportVersion).toBe(1);
  expect(envelope.format).toBe("suduku2-user-progress-v1");
  expect(envelope.progress.endless.entry.clearedLevel).toBe(7);
  expect(envelope.progress.endless.normal.clearedLevel).toBe(2);
  expect(envelope.progress.techniques["x-wing"]?.unlocked).toBe(true);

  const overwrite = await request.patch("/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      endless: { entry: { clearedLevel: 0 }, expert: { clearedLevel: 99 } },
      techniques: {},
    },
  });
  expect(overwrite.status()).toBe(204);

  const mid = (await (
    await request.get("/api/progress", {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()) as { endless: { entry: { clearedLevel: number }; expert: { clearedLevel: number } } };
  expect(mid.endless.entry.clearedLevel).toBe(0);
  expect(mid.endless.expert.clearedLevel).toBe(99);

  page.once("dialog", (d) => d.accept());
  const importStarted = Date.now();
  await page.getByTestId("progress-import-file").setInputFiles(tmpPath);
  await expect(page.getByTestId("progress-backup-message")).toContainText("导入成功", {
    timeout: 15_000,
  });
  expect(Date.now() - importStarted).toBeLessThan(BACKUP_OP_MAX_MS);

  const final = (await (
    await request.get("/api/progress", {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()) as {
    endless: typeof envelope.progress.endless;
    techniques: typeof envelope.progress.techniques;
  };
  expect(final.endless.entry.clearedLevel).toBe(7);
  expect(final.endless.normal.clearedLevel).toBe(2);
  expect(final.endless.expert.clearedLevel).toBe(0);
  expect(final.techniques["x-wing"]?.unlocked).toBe(true);
});

test("从 fixtures 导入合法 JSON 后服务器进度与文件中 progress 一致", async ({ page, request }) => {
  const { token } = await apiRegisterAndLogin(request);

  await request.patch("/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      endless: { entry: { clearedLevel: 5 } },
    },
  });

  const fixturePath = path.join(process.cwd(), "e2e/fixtures/valid-progress-backup.json");
  const fixtureRaw = await fs.readFile(fixturePath, "utf8");
  const fixture = JSON.parse(fixtureRaw) as {
    progress: {
      endless: Record<string, { clearedLevel: number }>;
      techniques: Record<string, unknown>;
    };
  };

  await injectAuth(page, token);
  await page.goto("/");

  page.once("dialog", (d) => d.accept());
  const importStarted = Date.now();
  await page.getByTestId("progress-import-file").setInputFiles(fixturePath);
  await expect(page.getByTestId("progress-backup-message")).toContainText("导入成功", {
    timeout: 15_000,
  });
  expect(Date.now() - importStarted).toBeLessThan(BACKUP_OP_MAX_MS);

  const body = (await (
    await request.get("/api/progress", {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()) as {
    endless: typeof fixture.progress.endless;
    techniques: typeof fixture.progress.techniques;
  };
  expect(body.endless).toEqual(fixture.progress.endless);
  expect(body.techniques).toEqual(fixture.progress.techniques);
});

test("导入无效 JSON 时显示中文错误", async ({ page, request }) => {
  const { token } = await apiRegisterAndLogin(request);
  await injectAuth(page, token);

  await page.goto("/");

  const badPath = path.join(process.cwd(), "e2e/fixtures/invalid-progress.json");

  page.once("dialog", (d) => d.accept());
  await page.getByTestId("progress-import-file").setInputFiles(badPath);
  await expect(page.getByTestId("progress-backup-message")).toContainText("JSON 格式无效", {
    timeout: 10_000,
  });
});
