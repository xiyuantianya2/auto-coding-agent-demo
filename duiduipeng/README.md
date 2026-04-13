# 对对碰（duiduipeng）

本仓库内的单机网页三消类「对对碰」子项目（Next.js + TypeScript + Tailwind），与 `link-game/`（连连看）并列。

## 本地运行

在仓库中进入本目录后：

```bash
cd duiduipeng
npm install
npm run dev
```

浏览器打开 **http://localhost:3001**（开发服务器固定 **3001**，避免与连连看默认 **3000** 冲突）。

其他常用脚本：

| 命令 | 说明 |
|------|------|
| `npm run lint` | ESLint |
| `npm run build` | 生产构建 |
| `npm run start` | 生产模式启动（端口 3001） |
| `npm test` | Vitest，运行 `lib/**/*.test.ts` 单元测试 |
| `npm run test:e2e` | Playwright E2E 测试（headed 浏览器，自动启动 dev server） |
| `npm run test:e2e:headed` | 同上（别名） |

Playwright 浏览器复用系统级缓存（`%LOCALAPPDATA%\ms-playwright`），与 `link-game` 共享同一份浏览器二进制文件，无需重复下载。如首次使用需安装浏览器，执行 `npx playwright install chromium`。

## E2E 测试

在本目录执行：

```bash
npm run test:e2e
```

Playwright 配置（`playwright.config.ts`）已内置 `webServer`，会自动在端口 3001 启动 dev server。测试文件位于 `e2e/` 目录。

## 手动验收路径（备选）

1. `npm run dev`，打开 http://localhost:3001 。
2. **新开一局**：点击「新游戏（第 1 关）」或刷新页面。
3. **暂停**：点击「暂停」，确认无法交换、用时冻结；点击「继续」恢复。
4. **提示**：点击「提示」，确认能高亮一步可行交换（或合理提示）；注意每局次数上限与冷却。
5. **通关或失败重试**：达目标分后在弹窗中选「下一关」或「新游戏（第 1 关）」；步数用尽后在弹窗中选「重试本关」或回到第 1 关。

详细架构与和连连看的差异见同目录 `architecture.md`（含**前期关卡目标分/步数表**与计分常量说明，与 `lib/level-progression.ts` 一致）。
