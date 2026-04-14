/**
 * 将进度导入/导出 API 错误映射为简短中文提示（供 UI 展示）。
 */

export function summarizeProgressApiError(status: number, bodyText: string): string {
  if (status === 401) {
    return "登录已失效，请重新登录后再试。";
  }
  if (status === 0) {
    return "网络连接失败，请检查网络后重试。";
  }
  const trimmed = bodyText.trim();
  if (trimmed.length === 0) {
    return `请求失败（HTTP ${status}）。`;
  }
  try {
    const w = JSON.parse(trimmed) as { error?: { code?: string; message?: string } };
    const code = w?.error?.code;
    const msg = w?.error?.message?.trim();
    if (code === "BAD_JSON" || (msg && /parse failed|Invalid JSON/i.test(msg))) {
      return "JSON 格式无效，无法解析。请确认文件为本应用导出的备份。";
    }
    if (code === "INVALID_PAYLOAD" && msg) {
      if (/import JSON parse failed/i.test(msg)) {
        return "JSON 格式无效，无法解析。请确认文件为本应用导出的备份。";
      }
      if (/unsupported import exportVersion|invalid imported progress/i.test(msg)) {
        return "备份版本不受支持或进度结构无效，无法导入。";
      }
      if (/exceeds max length/i.test(msg)) {
        return "文件过大，已拒绝导入。";
      }
      return `导入失败：${msg}`;
    }
    if (typeof msg === "string" && msg.length > 0) {
      return msg;
    }
  } catch {
    /* ignore */
  }
  return `请求失败（HTTP ${status}）。`;
}
