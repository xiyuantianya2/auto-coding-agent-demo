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

## 导出（Windows 桌面 / Android）

预设文件为根目录 [`export_presets.cfg`](./export_presets.cfg)：

| 预设 | 默认输出路径 | 说明 |
|------|----------------|------|
| **Windows Desktop** | `export/windows/link-game-godot.exe` | 单机可执行文件（`embed_pck=true`，单文件分发） |
| **Android** | `export/android/link-game-godot.apk` | 需本机 Android SDK / JDK；包名占位 `com.example.linkgamegodot`，发布前请改为自有 id |

`export/` 已在 [`.gitignore`](./.gitignore) 中忽略；**不要**将导出产物提交进仓库。

### 通用前置

- 使用与本工程兼容的 **Godot 4.x**（见 `project.godot` 的 `config/features`）；团队应统一编辑器小版本以减少差异。
- 首次导出需在编辑器中安装 **对应版本的导出模板**：**编辑器 → 管理导出模板**（或导出对话框中的链接）。未安装模板时无法导出。

### Windows 桌面（验收：可导出并双击运行）

1. 用 Godot 打开本工程 → **项目 → 导出**，选择预设 **「Windows Desktop」** → **导出项目**（路径可保持默认 `export/windows/link-game-godot.exe`）。
2. 或使用命令行（`godot` 需在 `PATH`，或设置环境变量 **`GODOT` / `GODOT_BIN`** 指向编辑器可执行文件）：

```bat
cd link-game-godot
godot --path . --headless --export-release "Windows Desktop" "export/windows/link-game-godot.exe"
```

3. 在资源管理器中双击 `export/windows/link-game-godot.exe` 应能启动当前版本游戏。

**减小包体**：根目录 [`.gdignore`](./.gdignore) 与预设中的 **`exclude_filter`** 已排除 `node_modules/`、`src/`（TypeScript）、`e2e/`、Playwright 报告目录及若干仅用于开发的文件，避免把 npm 依赖打进 `.pck`。

### Android（SDK / 密钥由开发者本机配置）

本仓库**不提交** keystore、密钥口令、本机 Android SDK/JDK 绝对路径等敏感或与机器强绑定的内容；团队成员需在各自环境完成以下配置。

1. **导出模板**：与 Windows 相同，需安装 Godot 的 Android 导出模板。
2. **Android 构建模板**：在 Godot 菜单 **项目 → 安装 Android 构建模板**（或首次导出前执行  
   `godot --path . --install-android-build-template`）。会在工程内生成/更新 Gradle 相关文件（是否纳入版本库由团队自定）。
3. **编辑器设置**：**编辑器 → 编辑器设置 → 导出 → Android**，填写有效的 **Java SDK** 与 **Android SDK** 根目录（需包含 `platform-tools`、`build-tools` 等；通常通过 Android Studio 或 `sdkmanager` 安装）。
4. **签名**：调试安装包可使用调试证书；**发布**到商店需使用 **release keystore**，在 **项目 → 导出 → Android 预设** 中配置（或依赖编辑器凭据存储）。**切勿**将 `.keystore` / `.jks` 与密码提交到本仓库。
5. 选择预设 **「Android」** 导出为 `export/android/link-game-godot.apk`，再使用 `adb install` 或 IDE 部署到设备。

### 已知限制

- 未安装对应平台**导出模板**时，该平台预设无法完成导出。
- Android 在未正确配置 **SDK / JDK / 构建模板** 时，命令行或 UI 导出会报错（属环境未就绪）。
- 无头导出（`--headless --export-release`）依赖与本机编辑器一致的模板与平台工具链。
- 若工程由较低 `config/features` 版本创建、用较新 Godot 打开，一般可向前兼容；若出现导出选项异常，请以团队锁定的引擎版本为准。

## Godot 内自动化测试（无头）

本目录使用 **自定义 GDScript 断言套件**（`run_tests.gd`），**不依赖 GUT** 插件；若你希望改用 [GUT](https://github.com/bitwes/Gut)，可自行加入 `addons/gut` 并在 `project.godot` 启用插件，但本仓库的 CI/本地一键命令仍以 `run_tests.gd` 为准。

### 测试职责：Godot 内测试 vs Playwright 冒烟

| 层级 | 典型命令 | 职责 |
|------|-----------|------|
| **Godot 内自动化测试** | `godot --headless -s run_tests.gd` 或 `npm run test:godot` | 在引擎内验证 **GDScript 游戏逻辑**（路径判定、布局生成、提示/洗牌、选牌-消除与胜负等）。**这是本项目的功能正确性主测试。** |
| **Playwright 浏览器冒烟** | `npm run test:e2e`（由 `playwright.config.ts` 的 `webServer` 拉起 `npm run dev`） | 验证 **Node/npm 工具链** 与 **`public/` 静态占位页** 可访问；**不加载 Godot Web 运行时**，**不能替代** 上表的 Godot 内测试。 |

两者在 CI 中建议**都跑**：先 Godot 无头测试，再 Playwright（见下文 GitHub Actions 示例）。

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

### GitHub Actions 示例（`windows-latest`）

本仓库提供可复用的工作流：在 **Windows runner** 上下载 **Godot 4.3**（与 `project.godot` 的 `config/features` 对齐）、执行 `npm ci`、安装 Chromium、再依次 `npm run lint`、`npm run build`、**`godot --headless -s run_tests.gd`**、`npm run test:e2e`。

- 工作流文件：[`link-game-godot-ci.yml`](../.github/workflows/link-game-godot-ci.yml)（位于 monorepo 根目录的 `.github/workflows/`）。

若你在其它流水线中手写步骤，核心命令与本地一致（请将 `godot` 换成本机 Godot 可执行文件路径，或先加入 `PATH`）：

```powershell
cd link-game-godot
npm ci
npx playwright install chromium
godot --headless -s run_tests.gd
npm run test:e2e
```

（安装 npm 依赖时仍建议使用 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`，再单独 `npx playwright install chromium`，与上文「浏览器共享」一致。）

### 覆盖范围（摘要）

- 路径判定（≤2 弯 / ≤3 段）与边界用例
- 可解布局生成、确定性种子、洗牌 multiset
- **完整「选牌-消除」关键路径**：在满盘上取 `find_first_connectable_pair` → `find_link_path` → 清空两格，断言剩余牌数减 2
- **胜负条件**：仅剩一对可连牌时消除后盘面为空（胜利）；非法对（图案不同 / 含空格端点）路径 API 拒绝

## npm：静态占位页 + Playwright

为与仓库其他子项目一致，本目录包含 `package.json`，用于：

- `npm run dev`：在 **http://localhost:3004** 提供 `public/` **静态占位页**（与现有项目端口错开）。**默认不依赖 Godot Web 导出**；Playwright 冒烟验证的是该占位页与 dev server 管线。
- `npm run dev:web`（可选）：若你已启用 **Web（HTML5）导出** 并将产物输出到 `export/web/`（需在编辑器中新增 HTML5 预设并导出；当前 [`export_presets.cfg`](./export_presets.cfg) 仅为 Windows/Android），可用本命令对该目录启动静态服务（**需目录已存在**，否则 `serve` 会报错）。未启用 Web 导出时，请继续使用 `npm run dev`。
- `npm run test:e2e`：启动上述 dev server（默认 `npm run dev`）并运行 Playwright **冒烟**（**headless**；见上文「测试职责」）。
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
| `npm run dev:web` | （可选）对 `export/web/` 启动静态服务（需已完成 HTML5 导出） |
| `npm run test:godot` | 无头运行 `run_tests.gd`（需本机安装 Godot 4 并可执行） |

## 架构与任务

- 目录与模块规划见 [`architecture.md`](./architecture.md)。
- 开发任务分解见 [`task.json`](./task.json)。
