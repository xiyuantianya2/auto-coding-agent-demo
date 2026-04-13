# Coding Agent 指南（全项目通用）

> 参考：[Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

## 你应该用哪份说明？

| 场景 | 使用的文件 |
|------|------------|
| **首轮**：新项目、或刚清空应用准备重写任务清单与环境 | **`INITIALIZER.md`**（不要用本文件做主流程） |
| **第二轮及以后**：任务清单与 `init.sh` 已就绪 | **本文件 `CLAUDE.md`** |

---

## Project Context

本仓库包含多个游戏子项目，每个子项目独立运行：

| 子项目 | 目录 | 端口 | task.json 位置 |
|--------|------|------|----------------|
| 连连看 | `link-game/` | 3000 | 仓库根 `task.json` |
| 对对碰 | `duiduipeng/` | 3001 | `duiduipeng/task.json` |

技术栈统一：Next.js + TypeScript + Tailwind。
所有子项目均配置 Playwright E2E 测试（`e2e/` 目录 + `playwright.config.ts`）。
需求在各自的 **`task.json`**；进度在 **`progress.txt`**。

---

## MANDATORY: Coding Session Workflow

**每个 coding 会话**都按下面流程执行。一个会话只做**一个任务**。

### Step 1: 会话开场（快速对齐上下文）

按 1→6 顺序执行，**不要跳过任何步骤**：

1. **`pwd`** — 确认当前目录为仓库根。
2. **读取 `progress.txt`** — 了解最近做了什么、是否有遗留问题。
3. **读取 `task.json`** — 通读任务与 `passes` 状态（仅同步上下文，不要开始写代码）。
4. **`git log --oneline -20`** — 查看最近提交。
5. **阅读并执行 `./init.sh`** — 安装依赖、启动 dev server（默认 http://localhost:3000）。
6. **基线冒烟** — 在当前任务所属子项目目录下执行 `npx playwright test --headed`（Playwright E2E 会自动启动 dev server 并打开浏览器验证游戏流程）。例如 `link-game/` 或 `duiduipeng/`。若 Playwright 浏览器未安装，先执行 `npx playwright install chromium`（系统级缓存，一次安装全项目共享）。若 Playwright 不可用，退而使用 MCP 浏览器类工具（cursor-ide-browser 等）打开应用入口 URL 确认页面可达；不要仅用 `curl` 代替可见验证。

**硬性规则：基线确认前不得开始实现新功能。**

完成 1–6 后，**立即进入 Step 2**（不要停下来等确认、不要输出报告后等待用户指令）。

### Step 2: 选择任务

从 `task.json` 中选一条 `passes: false` 的最高优先级任务。

### Step 3: 实现

- 读任务描述和验收步骤
- 实现功能，遵循已有代码风格

### Step 4: 测试

1. `npm run lint` 无错误
2. `npm run build` 成功
3. **Playwright E2E 浏览器验证**（**必选**）：在当前任务所属子项目目录下执行 `npx playwright test --headed`，运行 headed 模式的端到端测试。每个子项目的 `playwright.config.ts` 已内置 `webServer` 自动启动 dev server（端口各不相同）。如果 Playwright 尚未安装浏览器，先执行 `npx playwright install chromium`（系统级缓存，一次安装全项目共享，**不要重复下载**）。
4. 若子项目尚无 E2E 测试文件，**必须**为当前任务的功能编写对应的 Playwright 测试用例到 `e2e/` 目录
5. 若 Playwright E2E 不可用或需要额外页面级验收，可退而使用 **MCP 浏览器工具**（如 cursor-ide-browser）做可见路径验证；不要只做 lint/build

### Step 5: 更新进度

在 `progress.txt` 顶部添加：

```
## [日期] - Task: [任务描述]

### What was done:
- [具体修改]

### Testing:
- [如何测试的]

### Notes:
- [给后续 agent 的说明]
```

### Step 6: 提交

1. 更新 `task.json`：将该任务 `passes` 改为 `true`
2. 一次性提交：

```bash
git add .
git commit -m "[task description] - completed"
```

**规则：**
- 只有所有测试通过后才标记 `passes: true`
- 永远不要删除或修改任务描述
- 一个 task 的所有变更（代码、progress.txt、task.json）在同一个 commit

---

## ⚠️ 阻塞处理

如果任务无法完成（缺环境配置、外部依赖不可用等）：

**禁止：** 提交 commit、标记 passes:true、假装完成

**必须：** 在 progress.txt 记录阻塞原因 → 输出阻塞信息 → 停止

---

## Project Structure

```
/
├── CLAUDE.md          # 本文件（全项目通用）
├── INITIALIZER.md     # 首轮初始化用
├── task.json          # link-game 任务定义
├── progress.txt       # 每次会话的进度日志
├── init.sh            # 开发环境初始化脚本
├── architecture.md    # 连连看架构说明
├── .cursor/rules/     # Cursor 规则（含 Playwright 测试规范）
├── link-game/         # 连连看（端口 3000）
│   ├── app/           # App Router 页面
│   ├── lib/           # 工具函数、游戏逻辑
│   ├── e2e/           # Playwright E2E 测试
│   └── playwright.config.ts
└── duiduipeng/        # 对对碰（端口 3001）
    ├── app/           # App Router 页面
    ├── lib/           # 纯逻辑与类型
    ├── components/    # UI 组件
    ├── e2e/           # Playwright E2E 测试
    ├── task.json      # 对对碰任务定义
    └── playwright.config.ts
```

## Commands

```bash
# 在各子项目目录下（link-game/ 或 duiduipeng/）
npm run dev              # 启动开发服务器
npm run build            # 生产构建
npm run lint             # 运行 linter
npm run test:e2e         # Playwright E2E 测试（headed 浏览器，自动验证）
npm run test:e2e:headed  # 同上（别名）
npm test                 # 单元测试（Vitest）
```

**Playwright 浏览器共享**：所有子项目共用系统级 Playwright 浏览器缓存（`%LOCALAPPDATA%\ms-playwright`），**不要**在每个项目中重复安装浏览器。

## Key Rules

1. **会话开场先执行** — 基线未确认前不开始新功能
2. **一个会话一个任务** — 做好一件事
3. **测试后才标记完成** — lint + build + Playwright E2E 浏览器验证（**必选，不可跳过**）
4. **记录进度** — progress.txt 帮助后续 agent 理解上下文
5. **一个 commit 一个 task** — 代码、进度、标记一起提交
6. **不要删任务** — 只能把 `passes: false` 改成 `true`
7. **阻塞时停止** — 不要假装完成
