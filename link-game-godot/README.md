# 连连看-godot

Godot **4.x** 连连看子项目（目标：**Windows 桌面** + **Android**），位于本 monorepo 的 `link-game-godot/`。

需求原文见 [`requirements-archive.md`](./requirements-archive.md)（**勿清空历史**）。

## 环境要求

- [Godot 4.x](https://godotengine.org/download)（与 `project.godot` 中 `config/features` 一致即可）
- 若运行浏览器 E2E：Node.js LTS、`npm`；Playwright 浏览器为**系统级缓存**（见下方）

## 用 Godot 打开与运行

1. 启动 Godot 编辑器 → **导入** → 选择本目录下的 `project.godot`。
2. 按 **F5** 运行当前主场景（`scenes/main.tscn`）。

### 对局规则（计时 / 提示 / 洗牌）

- **倒计时**：单局限时 **120 秒**（与 `scripts/main.gd` 中 `MATCH_TIME_SEC`、`src/match_rules.ts` 中 `MATCH_TIME_SECONDS` 一致）。时间耗尽后本局记为**失败**：不再接受点选消除，状态栏提示失败原因；可点击 **「重新开始」** 生成新局并重置倒计时与得分。
- **提示**：在仍有未消牌时，尝试高亮一对**同图案且当前规则下可连**的格子；若暂时枚举不到可连对（理论上可解满盘不应出现），会先尝试 **洗牌** 再找对；若洗牌仍失败则提示使用「重新开始」。
- **洗牌**：在**不改变各图案枚数**（ multiset 与生成器一致）的前提下随机重排非空格的牌，并重试直至盘面**全盘可解**（与布局生成器相同的可解性校验）；失败则提示重试或重新开始。

## Godot 内自动化测试（无头）

本目录使用 **自定义 GDScript 断言套件**（`run_tests.gd`），**不依赖 GUT** 插件；若你希望改用 [GUT](https://github.com/bitwes/Gut)，可自行加入 `addons/gut` 并在 `project.godot` 启用插件，但本仓库的 CI/本地一键命令仍以 `run_tests.gd` 为准。

### 一键运行（推荐）

在 `link-game-godot/` 下：

```bash
npm run test:godot
```

该脚本会调用本机 Godot，并以 **退出码** 表示成败：**0** 为全部通过，**非 0** 为失败（适合 CI）。在无头模式下会跑全盘可解性等较重用例，**常见 PC 上可能需数十秒**，属正常现象。

- 若 `godot` 不在 `PATH` 中，请设置环境变量 **`GODOT`** 或 **`GODOT_BIN`** 为 Godot 4 编辑器可执行文件的完整路径（Windows 示例：`set GODOT=C:\Godot\Godot_v4.x-stable_win64.exe`）。
- 直接调用引擎（与 `npm run test:godot` 等价）：

```bash
godot --headless -s run_tests.gd
```

### 覆盖范围（摘要）

- 路径判定（≤2 弯 / ≤3 段）与边界用例
- 可解布局生成、确定性种子、洗牌 multiset
- **完整「选牌-消除」关键路径**：在满盘上取 `find_first_connectable_pair` → `find_link_path` → 清空两格，断言剩余牌数减 2
- **胜负条件**：仅剩一对可连牌时消除后盘面为空（胜利）；非法对（图案不同 / 含空格端点）路径 API 拒绝

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
| `npm run build` | 校验关键 Godot 文件是否存在 + TypeScript `tsc` |
| `npm run lint` | 对 `e2e/` 与 `playwright.config.ts` 运行 ESLint |
| `npm run test:godot` | 无头运行 `run_tests.gd`（需本机安装 Godot 4 并可执行） |

## 架构与任务

- 目录与模块规划见 [`architecture.md`](./architecture.md)。
- 开发任务分解见 [`task.json`](./task.json)。
