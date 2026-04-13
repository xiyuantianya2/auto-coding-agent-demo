import { existsSync } from "fs";
import path from "path";

/**
 * Resolves the monorepo root (parent of hello-nextjs) where task.json lives.
 * Override with AUTOMATION_REPO_ROOT when deploying or using a custom layout.
 */
export function getAutomationRepoRoot(): string | null {
  const override = process.env.AUTOMATION_REPO_ROOT?.trim();
  if (override) {
    const resolved = path.resolve(override);
    if (existsSync(path.join(resolved, "task.json"))) return resolved;
    return null;
  }

  const cwd = process.cwd();
  const parent = path.join(cwd, "..");
  if (existsSync(path.join(parent, "task.json"))) return path.resolve(parent);
  if (existsSync(path.join(cwd, "task.json"))) return path.resolve(cwd);
  return null;
}
