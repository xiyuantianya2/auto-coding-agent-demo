import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const required = [
  "project.godot",
  "scenes/main.tscn",
  "scripts/main.gd",
  "scripts/board_model.gd",
  "scripts/link_path_finder.gd",
  "run_tests.gd",
  "icon.svg",
];

let ok = true;
for (const rel of required) {
  const p = resolve(root, rel);
  if (!existsSync(p)) {
    console.error(`[build] 缺少文件: ${rel}`);
    ok = false;
  }
}

if (!ok) {
  process.exit(1);
}

console.log("[build] Godot 项目关键文件校验通过。");
