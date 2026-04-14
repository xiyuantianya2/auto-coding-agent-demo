import { deserializeGameState, serializeGameState, type GameState } from "@/lib/core";
import {
  BadRequestError,
  isRecord,
  jsonOk,
  normalizePatchBodyForSaveProgress,
  readJsonBody,
  requireBearerToken,
  serverErrorToResponse,
  userProgressWithGlobalToJson,
} from "@/server/http";
import { getProgress, saveProgress } from "@/server/progress";

export async function GET(req: Request) {
  try {
    const token = requireBearerToken(req);
    const p = await getProgress(token);
    const payload = userProgressWithGlobalToJson(p, (draft) =>
      JSON.parse(serializeGameState(draft as GameState)) as unknown,
    );
    return jsonOk(payload);
  } catch (e) {
    return serverErrorToResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const token = requireBearerToken(req);
    const raw = await readJsonBody(req);
    if (!isRecord(raw)) {
      throw new BadRequestError("PATCH body must be a JSON object");
    }
    const patch = normalizePatchBodyForSaveProgress(raw, (wire) =>
      deserializeGameState(JSON.stringify(wire)),
    );
    await saveProgress(token, patch);
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverErrorToResponse(e);
  }
}
