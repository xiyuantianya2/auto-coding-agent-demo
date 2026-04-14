/**
 * HTTP 边界辅助：统一错误 JSON 形状、Bearer 解析、与 JSON 请求体解析。
 * Route Handlers 应保持轻量，将业务错误委托给本模块映射为 {@link Response}。
 */

import { DeserializeGameStateError } from "@/lib/core";

import {
  InvalidPasswordError,
  InvalidTokenError,
  InvalidUsernameError,
  UnknownUserError,
  UsernameConflictError,
  WrongPasswordError,
} from "./errors";
import type { EndlessGlobalState, UserProgress } from "./types";

/** 与所有 API 错误响应一致的最小形状 */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export class BadJsonError extends Error {
  readonly code = "BAD_JSON";

  constructor(message = "Invalid JSON request body") {
    super(message);
    this.name = "BadJsonError";
  }
}

export class BadRequestError extends Error {
  readonly code = "BAD_REQUEST";

  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";

  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function jsonOk(data: unknown, status = 200): Response {
  return jsonResponse(data, status);
}

export function jsonError(status: number, code: string, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return jsonResponse(body, status);
}

/**
 * 从 `Authorization: Bearer <token>` 或查询参数 `token` 读取会话令牌。
 */
export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    return t.length > 0 ? t : null;
  }
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("token");
    if (q && q.length > 0) return q;
  } catch {
    /* ignore */
  }
  return null;
}

export function requireBearerToken(req: Request): string {
  const t = getBearerToken(req);
  if (!t) {
    throw new UnauthorizedError();
  }
  return t;
}

export async function readJsonBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text || text.trim() === "") {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BadJsonError();
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `getProgress` 返回的运行时对象含 `draft` 为 {@link GameState}（含 `Set`），需转为可 JSON 化的 wire 对象再响应。
 */
export function userProgressWithGlobalToJson(
  p: UserProgress & { global: EndlessGlobalState },
  serializeDraft: (draft: Exclude<UserProgress["draft"], undefined | null>) => unknown,
): Record<string, unknown> {
  const { draft, global, ...rest } = p;
  return {
    ...rest,
    ...(draft !== undefined && draft !== null ? { draft: serializeDraft(draft) } : {}),
    global,
  };
}

/**
 * 将客户端 PATCH 体中的 `draft`（JSON wire）规范为 `saveProgress` 可接受的 {@link GameState}。
 */
export function normalizePatchBodyForSaveProgress(
  body: Record<string, unknown>,
  deserializeGameStateFromWire: (wire: unknown) => UserProgress["draft"],
): Partial<UserProgress> {
  const patch: Partial<UserProgress> = {};
  if ("techniques" in body && body.techniques !== undefined) {
    patch.techniques = body.techniques as UserProgress["techniques"];
  }
  if ("practice" in body && body.practice !== undefined) {
    patch.practice = body.practice as UserProgress["practice"];
  }
  if ("endless" in body && body.endless !== undefined) {
    patch.endless = body.endless as UserProgress["endless"];
  }
  if ("settings" in body && body.settings !== undefined) {
    patch.settings = body.settings as Record<string, unknown>;
  }
  if (Object.prototype.hasOwnProperty.call(body, "draft")) {
    const d = body.draft;
    if (d === null || d === undefined) {
      patch.draft = undefined;
    } else {
      patch.draft = deserializeGameStateFromWire(d);
    }
  }
  return patch;
}

export function serverErrorToResponse(err: unknown): Response {
  if (err instanceof BadJsonError) {
    return jsonError(400, err.code, err.message);
  }
  if (err instanceof BadRequestError) {
    return jsonError(400, err.code, err.message);
  }
  if (err instanceof UnauthorizedError) {
    return jsonError(401, err.code, err.message);
  }
  if (err instanceof UsernameConflictError) {
    return jsonError(409, err.code, err.message);
  }
  if (err instanceof InvalidPasswordError || err instanceof InvalidUsernameError) {
    return jsonError(400, err.code, err.message);
  }
  if (err instanceof UnknownUserError || err instanceof WrongPasswordError || err instanceof InvalidTokenError) {
    return jsonError(401, err.code, err.message);
  }
  if (err instanceof DeserializeGameStateError) {
    return jsonError(400, "INVALID_GAME_STATE", err.message);
  }
  if (err instanceof Error) {
    if (err.message.startsWith("suduku2/server:")) {
      return jsonError(400, "INVALID_PAYLOAD", err.message);
    }
    console.error(err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
  console.error(err);
  return jsonError(500, "INTERNAL_ERROR", "Internal server error");
}
