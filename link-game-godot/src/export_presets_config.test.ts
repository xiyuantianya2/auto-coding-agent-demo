import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("export_presets.cfg（任务 9：桌面与 Android 预设）", () => {
  it("包含 Windows Desktop 与 Android 预设，并配置非空 exclude_filter", () => {
    const text = readFileSync(resolve(root, "export_presets.cfg"), "utf8");
    expect(text).toContain('name="Windows Desktop"');
    expect(text).toContain('name="Android"');
    expect(text).toMatch(/exclude_filter="[^"]+\*\*[^"]+"/);
    expect(text).not.toContain('exclude_filter=""');
  });

  it(".gdignore 存在并忽略 node_modules", () => {
    const text = readFileSync(resolve(root, ".gdignore"), "utf8");
    expect(text).toContain("node_modules/");
  });
});
