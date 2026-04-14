import fs from "node:fs";
import path from "node:path";

/**
 * 覆盖数据根目录。若设置，可为绝对路径或相对路径（相对当前工作目录 `process.cwd()`），
 * 最终使用 `path.resolve` 规范化。
 *
 * @example `SUDUKU2_DATA_DIR=/var/lib/suduku2-data`
 */
export const SUDUKU2_DATA_DIR_ENV = "SUDUKU2_DATA_DIR";

function resolveDataDirPath(): string {
  const raw = process.env[SUDUKU2_DATA_DIR_ENV]?.trim();
  if (raw) {
    return path.resolve(raw);
  }
  return path.join(process.cwd(), "data");
}

/**
 * 返回可写的数据根目录绝对路径，并确保目录已存在（首次调用时创建，等价 `mkdir -p`）。
 * 仅做路径解析与单次目录创建，应在毫秒级完成。
 */
export function getDataDir(): string {
  const dir = resolveDataDirPath();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
