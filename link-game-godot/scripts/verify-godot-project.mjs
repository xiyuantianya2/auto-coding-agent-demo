import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const required = [
  "project.godot",
  "export_presets.cfg",
  ".gdignore",
  "scenes/main.tscn",
  "scripts/main.gd",
  "scripts/board_model.gd",
  "scripts/link_path_finder.gd",
  "scripts/link_game_solvability.gd",
  "scripts/board_layout_generator.gd",
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

const exportPresetsPath = resolve(root, "export_presets.cfg");
const exportPresets = readFileSync(exportPresetsPath, "utf8");
if (!exportPresets.includes('name="Windows Desktop"')) {
  console.error("[build] export_presets.cfg 缺少 Windows Desktop 导出预设。");
  process.exit(1);
}
if (!exportPresets.includes('name="Android"')) {
  console.error("[build] export_presets.cfg 缺少 Android 导出预设。");
  process.exit(1);
}
if (!exportPresets.includes("exclude_filter=") || exportPresets.includes('exclude_filter=""')) {
  console.error("[build] export_presets.cfg 应配置 exclude_filter 以排除 node_modules 等工具目录。");
  process.exit(1);
}

console.log("[build] Godot 项目关键文件校验通过。");
