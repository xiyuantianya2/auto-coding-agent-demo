# Initializer — 仅第一个 Context / 首轮会话使用

本文件对应 Anthropic [长时 Agent harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) 中的 **initializer agent**：**首轮专用 prompt**，与后续 **coding agent**（见 `CLAUDE.md`）分工不同；工具与仓库结构可以相同。

---

## 何时阅读本文件

在以下情况 **只** 执行本流程：

- 新仓库 / 新项目从零搭 harness；或
- 你已按 `README.md` 删除既有应用目录、准备重写任务清单与环境。

**若 `task.json` 已存在且任务列表与 `architecture.md` 一致、且 `init.sh` 可正常运行，** 说明 initializer 阶段已完成 — **不要** 再按本文件大改清单；请改用 **`CLAUDE.md`** 做增量开发。

---

## 本阶段的目标（只做「环境与清单」，不赶功能）

Initializer **不负责** 像 coding 会话那样「一次做完多个任务」。本轮只做：

1. 根据 **`architecture.md`**（及用户口头/文档目标）**生成或补全** 根目录 **`task.json`**（本仓库中的 **feature list**，语义等同官方示例里的 `feature_list.json`）。
2. **编写或校验** **`init.sh`**：能安装依赖、启动开发服务（例如 `hello-nextjs` 下 `npm install` + `npm run dev`），失败时行为明确。
3. **建立** **`progress.txt`**（对应文章中的 progress 日志；首轮写入第一条初始化记录）。
4. 在应用目录已可放置代码的前提下，**只做** 为上述脚本可运行所必需的 **最小脚手架**（例如空 Next 应用、`.env.local.example`），**不要** 提前实现 `task.json` 里大量业务任务。
5. **做一次有意义的初始 git commit**（例如 `chore: initial harness — task.json, init.sh, progress`），包含上述工件与必要目录结构。

---

## 强制工作流

### 1. 阅读输入

- 通读 **`architecture.md`**，明确技术栈、模块边界、对外依赖。
- 若用户另有需求说明，与架构文档对齐，缺失处写入 `architecture.md` 或记在 `progress.txt` 的 Notes 里供后续会话处理。

### 2. 生成或补全 `task.json`

- 结构保持与本仓库约定一致：顶层 `project`、`description`、`tasks` 数组。
- 每个任务包含：`id`、`title`、`description`、`steps`（可验证的步骤）、**`passes`: `false`**（初始化时 **一律为未完成**，除非项目规则明确要求仅有一条「仓库已创建」类任务 — 默认 **全部 `false`**）。
- 任务应 **可增量交付**：优先端到端可测的用户路径，拆成多条独立项，避免单条任务过大（避免「一口气做完整个应用」）。
- **规则（与 coding 阶段一致）**：之后 **只允许** 将某条的 `passes` 改为 `true`，**禁止** 删除任务、改写任务描述来「缩水」范围。

### 3. 编写或校验 `init.sh`

- 保证从仓库根目录执行 `./init.sh` 可重复成功（依赖安装 + 启动本地服务）。
- 若目标应用不在根目录而在子目录（如 `hello-nextjs/`），脚本内 `cd` 与路径需与此一致。

### 4. 初始化 `progress.txt`

- 写入第一条记录，至少包含：日期、本轮为 initializer、已创建/更新了哪些文件、`task.json` 任务数量、**明确写明下一会话应阅读 `CLAUDE.md` 并按其中流程执行**。

### 5. 最小代码库（如需要）

- 若尚无应用目录：仅创建能跑通 `init.sh` 的最小项目（例如 `package.json`、占位页面），**不要** 在本轮实现 `task.json` 中的业务功能列表。
- **Playwright E2E 必须在脚手架阶段配置**：
  - 添加 `@playwright/test` 为 devDependency（版本与仓库中其他项目一致，当前 `^1.59.1`）
  - 创建 `playwright.config.ts`（`testDir: "./e2e"`，`webServer` 自动启动 dev server，端口与现有项目错开）
  - 创建 `e2e/` 目录
  - 在 `package.json` 中添加 `test:e2e` 和 `test:e2e:headed` 脚本
  - **不要重复下载 Playwright 浏览器**：使用系统级缓存（`%LOCALAPPDATA%\ms-playwright`），安装 npm 包时设置 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
  - 在 README 和 architecture.md 中说明 E2E 测试命令

### 6. Git 初始提交

- 单 commit 包含：`task.json`、`init.sh`、`progress.txt`、以及为使 `init.sh` 成功所需的最小文件。
- Commit message 应能一眼看出是 **harness/initializer**，而非某个功能任务名。

---

## 本轮禁止事项

- ❌ 按 **`CLAUDE.md`** 的「选一项任务 → 实现 → 标 passes」循环 **连续完成多个业务任务**（那是后续会话的职责）。
- ❌ 在未经充分测试前将大量任务的 `passes` 标为 `true`。
- ❌ 删除或弱化 `task.json` 中的条目以「提前结案」。

---

## 结束 initializer 之后

- 后续 **每一个** 开发会话：只使用 **`CLAUDE.md`**（coding agent），直到项目需要重新初始化（例如完全换需求并重写 `task.json`）。

---

## 与 Anthropic 文章的对应关系

| 文章概念        | 本仓库 |
|----------------|--------|
| initializer 专用 prompt | 本文件 `INITIALIZER.md` |
| coding 专用 prompt      | `CLAUDE.md` |
| `feature_list.json`     | `task.json` |
| progress 文件           | `progress.txt` |
