import { login } from "@/server/login";
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
    if (typeof username !== "string" || typeof password !== "string") {
      throw new BadRequestError("username and password are required strings");
    }
    const { token } = await login(username, password);
    return jsonOk({ token });
  } catch (e) {
    return serverErrorToResponse(e);
  }
}
