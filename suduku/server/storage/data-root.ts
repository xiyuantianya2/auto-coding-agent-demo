import fs from "node:fs";
import path from "node:path";

/** 环境变量名：覆盖本地数据根目录（应为绝对路径或可解析路径）。 */
export const SUDUKU_DATA_DIR_ENV = "SUDUKU_DATA_DIR";

/**
 * 默认相对路径（相对于进程 cwd；在 `suduku/` 下执行 npm 脚本时即为项目内专用子目录）。
 * 与 {@link SUDUKU_DATA_DIR_ENV} 互斥。
 */
export const DEFAULT_DATA_DIR_RELATIVE = path.join(".data", "suduku");

/**
 * 解析本模块使用的本地数据根目录。
 *
 * - 若设置 `process.env.SUDUKU_DATA_DIR`，使用该值（`path.resolve` 为绝对路径）。
 * - 否则使用 `path.resolve(process.cwd(), {@link DEFAULT_DATA_DIR_RELATIVE})`。
 */
export function resolveSudukuDataDir(): string {
  const fromEnv = process.env[SUDUKU_DATA_DIR_ENV];
  if (fromEnv !== undefined && fromEnv.trim() !== "") {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), DEFAULT_DATA_DIR_RELATIVE);
}

/** 确保数据根目录存在（递归创建）。 */
export async function ensureDirExists(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}
