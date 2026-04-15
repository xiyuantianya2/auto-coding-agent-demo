# 连连看-godot

Godot **4.x** 连连看子项目（目标：**Windows 桌面** + **Android**），位于本 monorepo 的 `link-game-godot/`。

需求原文见 [`requirements-archive.md`](./requirements-archive.md)（**勿清空历史**）。

## 环境要求

- [Godot 4.x](https://godotengine.org/download)（与 `project.godot` 中 `config/features` 一致即可）
- 若运行浏览器 E2E：Node.js LTS、`npm`；Playwright 浏览器为**系统级缓存**（见下方）

## 用 Godot 打开与运行

1. 启动 Godot 编辑器 → **导入** → 选择本目录下的 `project.godot`。
2. 按 **F5** 运行当前主场景（`scenes/main.tscn`）。

## 命令行：无头测试入口（占位）

脚手架提供 `run_tests.gd`，用于后续接入 GUT 或自定义断言后，在 CI 本地执行：

```bash
godot --headless -s run_tests.gd
```

当前脚本仅打印日志并以退出码 **0** 结束，用于验证管线可调用。

> 若 `godot` 未在 `PATH` 中，请使用 Godot 可执行文件的完整路径。

## npm：静态占位页 + Playwright

为与仓库其他子项目一致，本目录包含 `package.json`，用于：

- `npm run dev`：在 **http://localhost:3004** 提供 `public/` 静态占位页（与现有项目端口错开）。
- `npm run test:e2e`：启动上述 dev server 并运行 Playwright（**headless**）。
- `npm run test:e2e:headed`：有界面浏览器运行 E2E。

首次在本机安装 Playwright 浏览器（**全仓库共享缓存**，只需一次）：

```bash
npx playwright install chromium
```

安装 npm 依赖时建议跳过重复下载浏览器二进制：

```bash
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install
```

（PowerShell 可用 `$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。）

## 其他脚本

| 命令 | 说明 |
|------|------|
| `npm run build` | 校验关键 Godot 文件是否存在（脚手架阶段）；后续可扩展为导出 |
| `npm run lint` | 对 `e2e/` 与 `playwright.config.ts` 运行 ESLint |

## 架构与任务

- 目录与模块规划见 [`architecture.md`](./architecture.md)。
- 开发任务分解见 [`task.json`](./task.json)。
