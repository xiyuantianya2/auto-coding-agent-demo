import {
  BadRequestError,
  isRecord,
  readJsonBody,
  requireBearerToken,
  serverErrorToResponse,
} from "@/server/http";
import { importProgress } from "@/server/progress";

export async function POST(req: Request) {
  try {
    const token = requireBearerToken(req);
    const raw = await readJsonBody(req);
    if (!isRecord(raw)) {
      throw new BadRequestError("Request body must be a JSON object");
    }
    const json = raw.json;
    if (typeof json !== "string") {
      throw new BadRequestError("json field must be a string");
    }
    await importProgress(token, json);
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverErrorToResponse(e);
  }
}
