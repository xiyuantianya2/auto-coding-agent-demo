import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("Godot headless test runner (npm)", () => {
  it("package.json exposes test:godot -> run-godot-tests.mjs", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["test:godot"]).toBe("node ./scripts/run-godot-tests.mjs");
  });
});
