# Spring FES Video — Coding Agent（后续会话专用）

## 你应该用哪份说明？

| 场景 | 使用的文件 |
|------|------------|
| **首轮**：新项目、或刚清空应用准备重写任务清单与环境 | **`INITIALIZER.md`**（不要用本文件做主流程） |
| **第二轮及以后**：任务清单与 `init.sh` 已就绪 | **本文件 `CLAUDE.md`** |

> **Initializer** 与 **coding** 只有「用户提示/职责」不同；工具、目录、约束可以相同。若你不确定是否已做过 initializer，先看根目录是否已有合理的 `task.json`（条目完整、`passes` 大多为 `false`）、可运行的 `init.sh`、以及 `progress.txt` 中的初始化记录。

---

## Project Context

A video processing application with Next.js frontend (`hello-nextjs/`). Requirements live in **`task.json`** (feature list); history lives in **`progress.txt`**.

---

## MANDATORY: Coding Session Workflow

**Every coding session** (not the first initializer session) MUST follow this workflow.

### Step 1: Session opening（固定脚本，与 Anthropic 文章一致）

每个 coding 会话开头按 **下面 1→6 的顺序** 执行。顺序与[文章](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)中的典型会话一致：`pwd` → progress → feature 列表 → `git log` → `init.sh` → 浏览器基线冒烟 → 再进入任务选择与实现。

**硬性规则：在步骤 6 的基线确认完成之前，不得开始实现任何新功能。** 若基线已坏，应先修复（可视为本会话唯一目标），或按下文「阻塞处理」记录并停止；不要一边基线损坏一边叠加新需求。这直接针对两类失败模式：**环境/应用已坏仍继续开发**、**未验证就实现新功能**。

1. **`pwd`** — 确认当前目录为仓库根；只在本仓库约定路径内编辑文件。
2. **读取 `progress.txt`** — 了解最近会话做了什么、是否有遗留问题或阻塞说明。
3. **读取 `task.json`（feature list）** — 通读任务与 `passes` 状态；本步仅同步上下文，**不要在此步开始写实现代码**。
4. **`git log --oneline -20`** — 查看最近提交，对齐代码与进度描述。
5. **阅读并执行 `./init.sh`** — 先读脚本内容再运行；安装依赖并启动开发服务器（默认 http://localhost:3000）。**不可跳过。**
6. **基线冒烟（浏览器，必须）** — 使用 MCP Playwright（或等效方式）像用户一样验证**已有**核心路径仍可用（例如首页可加载、导航可用；若已具备登录/主流程，则覆盖最近 progress 中涉及的关键路径）。若发现回归：**优先修复**至可接受状态，或判定为阻塞并停止。

   - 项目极早期、几乎无可测功能时，冒烟至少包含：开发服务可达、约定入口页面可访问；并在 `progress.txt` 中简短说明「当前基线范围」。

完成步骤 1–6 且基线可用后，再进入 **Step 2**。

### Step 2: Select Next Task

**仅**在 Step 1 完成且基线已确认可用后进行（或你已判定阻塞并停止，不选新任务）。

Read `task.json` and select **ONE** task to work on.

Selection criteria (in order of priority):

1. Choose a task where `passes: false`
2. Consider dependencies — fundamental features should be done first
3. Pick the highest-priority incomplete task

### Step 3: Implement the Task

- Read the task description and steps carefully
- Implement the functionality to satisfy all steps
- Follow existing code patterns and conventions

### Step 4: Test Thoroughly

After implementation, verify ALL steps in the task:

**强制测试要求（Testing Requirements - MANDATORY）：**

1. **大幅度页面修改**（新建页面、重写组件、修改核心交互）：
   - **必须在浏览器中测试！** 使用 MCP Playwright 工具
   - 验证页面能正确加载和渲染
   - 验证表单提交、按钮点击等交互功能
   - 截图确认 UI 正确显示

2. **小幅度代码修改**（修复 bug、调整样式、添加辅助函数）：
   - 可以使用单元测试或 lint/build 验证
   - 如有疑虑，仍建议浏览器测试

3. **所有修改必须通过**：
   - `npm run lint` 无错误
   - `npm run build` 构建成功
   - 浏览器/单元测试验证功能正常

**测试清单：**

- [ ] 代码没有 TypeScript 错误
- [ ] lint 通过
- [ ] build 成功
- [ ] 功能在浏览器中正常工作（对于 UI 相关修改）

### Step 5: Update Progress

Write your work to `progress.txt`:

```
## [Date] - Task: [task description]

### What was done:
- [specific changes made]

### Testing:
- [how it was tested]

### Notes:
- [any relevant notes for future agents]
```

### Step 6: Commit Changes (包含 task.json 更新)

**IMPORTANT: 所有更改必须在同一个 commit 中提交，包括 task.json 的更新！**

流程：

1. 更新 `task.json`，将任务的 `passes` 从 `false` 改为 `true`
2. 更新 `progress.txt` 记录工作内容
3. 一次性提交所有更改：

```bash
git add .
git commit -m "[task description] - completed"
```

**规则:**

- 只有在所有步骤都验证通过后才标记 `passes: true`
- 永远不要删除或修改任务描述
- 永远不要从列表中移除任务
- **一个 task 的所有内容（代码、progress.txt、task.json）必须在同一个 commit 中提交**

---

## ⚠️ 阻塞处理（Blocking Issues）

**如果任务无法完成测试或需要人工介入，必须遵循以下规则：**

### 需要停止任务并请求人工帮助的情况：

1. **缺少环境配置**：
   - .env.local 需要填写真实的 API 密钥
   - Supabase 项目需要创建和配置
   - 外部服务需要开通账号

2. **外部依赖不可用**：
   - 第三方 API 服务宕机
   - 需要人工授权的 OAuth 流程
   - 需要付费升级的服务

3. **测试无法进行**：
   - 登录/注册功能需要真实用户账号
   - 功能依赖外部系统尚未部署
   - 需要特定硬件环境

### 阻塞时的正确操作：

**DO NOT（禁止）：**

- ❌ 提交 git commit
- ❌ 将 task.json 的 passes 设为 true
- ❌ 假装任务已完成

**DO（必须）：**

- ✅ 在 progress.txt 中记录当前进度和阻塞原因
- ✅ 输出清晰的阻塞信息，说明需要人工做什么
- ✅ 停止任务，等待人工介入

### 阻塞信息格式：

```
🚫 任务阻塞 - 需要人工介入

**当前任务**: [任务名称]

**已完成的工作**:
- [已完成的代码/配置]

**阻塞原因**:
- [具体说明为什么无法继续]

**需要人工帮助**:
1. [具体的步骤 1]
2. [具体的步骤 2]
...

**解除阻塞后**:
- 运行 [命令] 继续任务
```

---

## Project Structure

```
/
├── INITIALIZER.md     # First session only — scaffold task.json, init.sh, progress
├── CLAUDE.md          # This file — coding sessions (session 2+)
├── task.json          # Task definitions (source of truth)
├── progress.txt       # Progress log from each session
├── init.sh            # Initialization script
└── hello-nextjs/      # Next.js application
    ├── src/app/       # App Router pages
    ├── src/components/
    └── ...
```

## Commands

```bash
# In hello-nextjs/
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run linter
```

## Coding Conventions

- TypeScript strict mode
- Functional components with hooks
- Tailwind CSS for styling
- Write tests for new features

---

## Key Rules

1. **Session opening script first** - 每会话按 Step 1 的 1→6 顺序执行；**基线未确认前不开始新功能**
2. **One task per session** - Focus on completing one task well
3. **Test before marking complete** - All steps must pass（含 `npm run lint` / `npm run build` 等，见 Step 4）
4. **Browser testing for UI changes** - 新建或大幅修改页面必须在浏览器测试
5. **Document in progress.txt** - Help future agents understand your work
6. **One commit per task** - 所有更改（代码、progress.txt、task.json）必须在同一个 commit 中提交
7. **Never remove tasks** - Only flip `passes: false` to `true`
8. **Stop if blocked** - 需要人工介入时，不要提交，输出阻塞信息并停止
