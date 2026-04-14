/**
 * 模块分解层的 Agent Prompt 构建器。
 * 提供三种 prompt：
 *  1. 项目 → 模块分解（生成 module-plan.json）
 *  2. 模块初始化（为单个模块生成 task.json）
 *  3. 模块内任务执行（增强版 agent message，带模块上下文）
 */
import path from "node:path";
import {
  deriveModulePlanPath,
  deriveModuleTaskJsonPath,
  getCompletedModulesSummary,
} from "./module-scheduler.mjs";

/**
 * 构建「项目 → 模块分解」的 prompt。
 * Agent 的任务是分析项目需求并生成 module-plan.json。
 */
export function buildProjectDecompositionPrompt(repoRoot, project, taskJsonPath, userDescription) {
  const planPath = path.join(repoRoot, deriveModulePlanPath(taskJsonPath));

  return [
    `你是本仓库的架构分析 agent。工作区根目录：${repoRoot}`,
    ``,
    `你的唯一任务是：将一个大型项目的需求分解为**多个独立模块**，并生成模块计划文件。`,
    `你不需要实现任何功能代码，只需要完成模块分解。`,
    ``,
    `项目信息：`,
    `- 名称：${project.name}`,
    `- 目录：${project.dir}/`,
    `- 用户描述：`,
    `---`,
    userDescription,
    `---`,
    ``,
    `执行步骤：`,
    `1. 浏览 ${project.dir}/ 目录的代码结构（如果已有代码），了解项目背景。`,
    `2. 如果存在 architecture.md，阅读并理解整体架构。`,
    `3. 将项目分解为 4-10 个独立模块，每个模块负责一个明确的子系统。`,
    `4. 将结果写入模块计划文件。`,
    ``,
    `模块计划文件路径：${planPath}`,
    ``,
    `JSON 格式（严格遵守）：`,
    `{`,
    `  "project": "${project.name}",`,
    `  "description": "项目整体描述",`,
    `  "modules": [`,
    `    {`,
    `      "id": "module-id",`,
    `      "title": "模块标题（中文）",`,
    `      "description": "该模块要实现什么、边界在哪里（2-3 句话）",`,
    `      "dir": "模块代码放置的子目录（相对于 ${project.dir}/，如 lib/solver）",`,
    `      "dependencies": ["依赖的其他模块 id，无依赖则为空数组"],`,
    `      "interface": "该模块对外暴露的核心接口签名（其他模块如何调用它）",`,
    `      "status": "pending"`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `模块分解原则：`,
    `- 每个模块应有清晰的职责边界和对外接口`,
    `- 模块间通过 interface 字段定义的接口交互，避免隐式耦合`,
    `- dependencies 必须正确反映模块间的依赖关系（被依赖者先开发）`,
    `- 不能有循环依赖`,
    `- 基础/核心模块（如数据模型、算法引擎）应无依赖或少依赖`,
    `- UI/集成类模块放在最后，依赖核心模块`,
    `- 每个模块预计 3-10 个开发任务（不在此处列出具体任务，仅描述模块范围）`,
    `- 最后一个模块应是"集成测试与验收"，依赖所有其他模块`,
    ``,
    `实现策略原则（务必在模块描述中体现）：`,
    `- **先跑通再优化**：模块 description 中的算法/生成策略应优先选择简单、可靠、**性能可控**的方案，而非追求理论最优。例如：随机生成算法应优先保证在合理时间内（< 数秒）产出合格结果，宁可牺牲最优性（如多保留一些冗余数据）也不要追求极限优化导致生成超时或需要海量重试。`,
    `- **避免不必要的极限追求**：若用户描述中没有明确要求「最少」「最小」「最优」等极限约束，模块描述中不要自行添加。例如：数独出题不必追求「最少提示数」（17个），保留适量冗余提示即可保证唯一解；图形布局不必追求像素级最优排列，视觉合理即可。`,
    `- **显式标注性能预期**：对计算密集型模块（如生成器、求解器、搜索算法），在 description 中注明目标耗时量级（如「单次生成应在 5 秒内完成」），让后续任务实现时有明确的性能预算。`,
    ``,
    `模块 id 命名：全小写英文，用连字符分隔，如 puzzle-generator、hint-system。`,
    `所有 status 必须为 "pending"。`,
    ``,
    `硬性要求：`,
    `- 只写入模块计划文件（${planPath}），不要修改任何其他文件`,
    `- 确保 JSON 格式正确，可被 JSON.parse 解析`,
    `- 模块数量 4-10 个`,
    `- 不能有循环依赖`,
  ].join("\n");
}

/**
 * 判断模块是否涉及 UI / 浏览器 / 集成验收。
 * - dir 以 "app" 或 "e2e" 开头
 * - id 含 "ui"/"client"/"frontend"/"integration"/"e2e"/"qa"
 */
function isUiModule(targetModule) {
  const dir = (targetModule.dir || "").toLowerCase();
  const id = (targetModule.id || "").toLowerCase();
  return (
    dir === "app" ||
    dir.startsWith("app/") ||
    dir.startsWith("app\\") ||
    dir === "e2e" ||
    dir.startsWith("e2e/") ||
    dir.startsWith("e2e\\") ||
    id.includes("ui") ||
    id.includes("client") ||
    id.includes("frontend") ||
    id.includes("integration") ||
    id.includes("e2e") ||
    id.includes("qa")
  );
}

/**
 * 构建「模块初始化」的 prompt。
 * Agent 为某个特定模块生成 task.json。
 */
export function buildModuleInitializerPrompt(repoRoot, project, taskJsonPath, modulePlan, targetModule) {
  const moduleTaskPath = path.join(
    repoRoot,
    deriveModuleTaskJsonPath(taskJsonPath, targetModule.id),
  );
  const completedSummary = getCompletedModulesSummary(modulePlan);

  const depModules = (targetModule.dependencies || [])
    .map((depId) => modulePlan.modules.find((m) => m.id === depId))
    .filter(Boolean);
  const depInfo = depModules.length > 0
    ? depModules.map((d) => `  - ${d.title}（${d.id}）：${d.interface}`).join("\n")
    : "  （无前置依赖）";

  return [
    `你是本仓库的 coding agent。工作区根目录：${repoRoot}`,
    ``,
    `你的唯一任务是：为项目「${project.name}」的一个**特定模块**生成开发任务列表（task.json）。`,
    `你不需要实现任何功能代码，只需要分析模块需求并输出任务。`,
    ``,
    `项目概况：`,
    `- 名称：${project.name}`,
    `- 描述：${modulePlan.description}`,
    `- 目录：${project.dir}/`,
    ``,
    `已完成的模块：`,
    completedSummary,
    ``,
    `当前要分解的模块：`,
    `- ID：${targetModule.id}`,
    `- 标题：${targetModule.title}`,
    `- 描述：${targetModule.description}`,
    `- 代码目录：${project.dir}/${targetModule.dir}`,
    `- 对外接口：${targetModule.interface}`,
    `- 前置依赖：`,
    depInfo,
    ``,
    `执行步骤：`,
    `1. 浏览 ${project.dir}/ 目录的现有代码结构，了解已完成模块的实现。`,
    `2. 如果存在 architecture.md，阅读并理解架构设计。`,
    `3. 将该模块分解为 3-10 个可独立完成和验证的开发任务。`,
    `4. 将任务列表写入文件。`,
    ``,
    `任务文件路径：${moduleTaskPath}`,
    ``,
    `JSON 格式（严格遵守）：`,
    `{`,
    `  "project": "${project.name}",`,
    `  "module": "${targetModule.id}",`,
    `  "moduleTitle": "${targetModule.title}",`,
    `  "description": "${targetModule.description}",`,
    `  "tasks": [`,
    `    {`,
    `      "id": 1,`,
    `      "title": "任务标题",`,
    `      "description": "任务描述",`,
    `      "steps": ["验收步骤1", "验收步骤2"],`,
    `      "passes": false`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `任务分解原则：`,
    `- 任务按依赖顺序排列，从基础设施到功能实现`,
    `- 每个任务应可独立验证（有明确的验收步骤）`,
    `- 第一个任务通常是模块的类型定义与基础结构`,
    `- 最后一个任务通常是模块的集成测试`,
    `- 任务中应考虑与已完成模块的接口对接`,
    `- 任务 steps 中应包含在 ${project.dir} 目录下执行 npm run lint 和 npm run build 的要求`,
    `- 若任务包含编写单元/集成测试，steps 中应包含在 ${project.dir} 目录下执行 npm test 并确保全部通过`,
    `- 涉及性能敏感操作（如高计算量算法、大量迭代的生成器等）的测试步骤应注明：对已知慢路径（如高难度档位生成）仅做结构冒烟而非全量覆盖，或设置合理的 test timeout`,
    isUiModule(targetModule)
      ? `- 本模块涉及 UI，任务 steps 中应包含编写和运行 Playwright E2E 测试的要求`
      : `- 本模块不涉及 UI，任务 steps 中**不要**包含 Playwright E2E 测试的要求，仅通过 Vitest 单元/集成测试验收即可`,
    ``,
    `实现策略原则（任务描述中必须体现）：`,
    `- **性能优先于最优性**：涉及随机生成、搜索、求解类算法的任务，description 中应明确要求「单次调用在合理时间内完成（通常 < 5 秒）」。若模块描述中提到生成/搜索策略，任务应继承并细化这些性能约束。`,
    `- **禁止自行添加极限约束**：若模块 description 中没有要求「最少」「最小」「最优」等极限目标，任务 description 不要自行引入。例如：「生成唯一解题目」的任务不应追加「且提示数最少」的要求——保留冗余提示既能加速生成又不影响玩法。`,
    `- **渐进式复杂度**：先实现能稳定运行的简单版本，再在后续任务中添加优化或约束收紧。不要在一个任务中同时要求算法正确性和极限性能。`,
    ``,
    `硬性要求：`,
    `- 只创建/写入上述任务文件，不要修改任何其他文件`,
    `- 确保 JSON 格式正确，可被 JSON.parse 解析`,
    `- 所有任务的 passes 必须为 false`,
    `- 任务 id 从 1 开始递增`,
    `- 任务数量 3-10 个`,
  ].join("\n");
}

/**
 * 构建模块内任务执行的 agent message（增强版，包含模块上下文）。
 */
export function buildModuleTaskMessage(repoRoot, project, taskJsonPath, modulePlan, targetModule, task) {
  const steps = Array.isArray(task.steps) ? task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "";
  const moduleTaskPath = path.join(
    repoRoot,
    deriveModuleTaskJsonPath(taskJsonPath, targetModule.id),
  );
  const completedSummary = getCompletedModulesSummary(modulePlan);

  const depModules = (targetModule.dependencies || [])
    .map((depId) => modulePlan.modules.find((m) => m.id === depId))
    .filter(Boolean);
  const depInfo = depModules.length > 0
    ? depModules.map((d) => `  - ${d.title}（${d.id}）：目录 ${project.dir}/${d.dir}，接口：${d.interface}`).join("\n")
    : "  （无前置依赖）";

  const needsE2E = isUiModule(targetModule);

  const testInstructions = needsE2E
    ? [
        `- 单元/集成测试：若本模块有 vitest / jest 测试（检查 package.json 的 test 脚本），在 ${project.dir} 目录执行 \`npm test\` 确保全部通过。先跑单元测试再跑 E2E——单元测试更快、反馈更精准，优先用它定位问题。`,
        `- 浏览器自动化验收（Playwright E2E）：在 ${project.dir}/ 目录下执行 \`npx playwright test --headed\`（或 \`npm run test:e2e\`），它会自动启动 dev server 并打开 Chromium 浏览器窗口，运行 E2E 测试。Playwright 配置已内置 webServer 自动启动 dev。如果浏览器未安装，先执行 \`npx playwright install chromium\`（系统级缓存，不要重复下载）。若 e2e/ 目录下尚无测试文件，需为当前任务的功能编写 Playwright 测试用例。全部测试通过才算验收成功。`,
      ]
    : [
        `- 单元/集成测试：在 ${project.dir} 目录执行 \`npm test\` 确保全部通过。本模块不涉及 UI，**无需编写或运行 Playwright E2E 测试**，仅通过 Vitest 单元/集成测试验收即可。`,
      ];

  return [
    `你是本仓库的 coding agent。工作区根目录：${repoRoot}`,
    ``,
    `应用代码在子目录 ${project.dir}/。执行 npm 脚本时请在 ${project.dir} 目录下。`,
    ``,
    `你正在开发「${project.name}」项目的「${targetModule.title}」模块。`,
    `模块代码目录：${project.dir}/${targetModule.dir}`,
    `模块对外接口：${targetModule.interface}`,
    ``,
    `该模块依赖的已完成模块：`,
    depInfo,
    ``,
    `所有已完成模块概览：`,
    completedSummary,
    ``,
    `【本步唯一目标】只完成任务 task id=${task.id}（不要并行做其它 task）：`,
    `标题：${task.title}`,
    task.description ? `说明：${task.description}` : "",
    `验收步骤：`,
    steps,
    ``,
    `硬性要求：`,
    `- 实现完成后：修改模块任务文件（路径：${moduleTaskPath}），将 id=${task.id} 的 passes 改为 true。`,
    `- 在 ${project.dir} 目录执行 npm run lint 与 npm run build，修复直至通过。`,
    ...testInstructions,
    `- 仅修改与「${targetModule.title}」模块相关的文件，不要随意修改其他模块的代码。`,
    `- 单次 git commit 包含本任务相关变更（若使用 git）。`,
    ``,
    `实现策略原则：`,
    `- **先跑通再优化**：优先选择简单、可靠、性能可控的实现，宁可牺牲理论最优性也要保证在合理时间内（单次调用通常 < 5 秒）产出合格结果。例如：随机生成类功能不必追求极限参数（最少给定数、最高压缩率等），保留适量冗余既能大幅加速生成又不影响功能正确性。`,
    `- **不要自行添加极限约束**：若任务描述中没有明确要求「最少」「最小」「最优」等极限目标，实现时不要自行引入。生成/搜索/优化类算法应以「足够好且快速」为目标，而非「理论最优但可能超时」。`,
    `- **耗时操作要有保底退出**：任何可能长时间运行的循环/递归（生成器重试、回溯搜索、迭代优化），必须设置合理的最大尝试次数和/或墙上时钟超时（如 maxAttempts、maxElapsedMs），超限时返回当前最优可用结果或抛出明确错误，绝不能无限循环。`,
    ``,
    `测试编写注意事项：`,
    `- 性能敏感路径：若被测功能有已知的高耗时路径（如高难度档位的生成/求解，大量迭代的算法），测试应仅对快速路径（如 easy/normal 档）做全量断言，对慢路径（如 hard/hell 档）仅做结构冒烟（验证返回类型、字段存在即可）或完全跳过，并为慢速测试设置充裕的 timeout（如 \`{ timeout: 120_000 }\`）。避免在一个 it() 中串行运行多个高耗时操作。`,
    `- Mock 可靠性：对 Node 内置模块（如 crypto、fs）做 spy/mock 时，注意 ESM 具名导入（\`import { randomUUID } from "node:crypto"\`）绑定的是导入时的引用，\`vi.spyOn(crypto, "randomUUID")\` 不会生效。应在被测模块中使用命名空间导入（\`import crypto from "node:crypto"\` 再调用 \`crypto.randomUUID()\`），或使用 \`vi.mock("node:crypto", ...)\` 整体替换模块。`,
    needsE2E
      ? `- E2E flaky 处理：若 Playwright 测试在并行模式下有偶发 flaky（如启动竞争），优先在 spec 里标记 \`test.describe.configure({ retries: 1 })\` 或降低并发（\`--workers=1\`），而非忽略失败。`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
