import { requireBearerToken, serverErrorToResponse } from "@/server/http";
import { exportProgress } from "@/server/progress";

/**
 * 返回可下载的 JSON 文本（与 `exportProgress` 字符串一致，`Content-Type: application/json`）。
 */
export async function GET(req: Request) {
  try {
    const token = requireBearerToken(req);
    const text = await exportProgress(token);
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return serverErrorToResponse(e);
  }
}
