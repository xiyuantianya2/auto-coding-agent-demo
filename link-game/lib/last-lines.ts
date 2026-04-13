/** 取文本按行分割后的末尾若干行（用于面板展示，避免一次渲染过多行） */
export function takeLastLines(text: string, maxLines: number): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  if (lines.length <= maxLines) return text;
  return lines.slice(-maxLines).join("\n");
}

export const PANEL_DISPLAY_MAX_LINES = 500;
