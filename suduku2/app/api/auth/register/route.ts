import { register } from "@/server/register";
import {
  BadRequestError,
  isRecord,
  jsonOk,
  readJsonBody,
  serverErrorToResponse,
} from "@/server/http";

export async function POST(req: Request) {
  try {
    const raw = await readJsonBody(req);
    if (!isRecord(raw)) {
      throw new BadRequestError("Request body must be a JSON object");
    }
    const username = raw.username;
    const password = raw.password;
    const nickname = raw.nickname;
    if (typeof username !== "string" || typeof password !== "string") {
      throw new BadRequestError("username and password are required strings");
    }
    if (nickname !== undefined && typeof nickname !== "string") {
      throw new BadRequestError("nickname must be a string when provided");
    }
    const { userId } = await register(username, password, nickname);
    return jsonOk({ userId }, 201);
  } catch (e) {
    return serverErrorToResponse(e);
  }
}
