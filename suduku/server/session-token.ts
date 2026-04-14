import crypto from "node:crypto";

/**
 * ## 会话 token（任务 4）
 *
 * - **格式**：`suduku-session-v1.<base64url(payloadJson)>.<base64url(hmac-sha256)>`
 * - **payload**：`{ v: 1, uid: UserId, iat: number, exp: number }`（毫秒时间戳）
 * - **签名**：对 **UTF-8 的 payload 字符串**做 HMAC-SHA256，密钥来自 {@link SUDUKU_SESSION_SECRET_ENV}。
 * - **HTTP 约定（本模块不解析头）**：后续路由应接受 `Authorization: Bearer <token>`，取出 `<token>` 后调用 {@link validateToken}。
 *
 * 客户端无法伪造 `uid`：篡改 payload 会破坏 HMAC；服务端未配置密钥时 {@link validateToken} 恒失败。
 */

/** 环境变量：会话 HMAC 密钥（建议高熵随机串；勿提交仓库）。 */
export const SUDUKU_SESSION_SECRET_ENV = "SUDUKU_SESSION_SECRET";

/** 环境变量：会话有效期（毫秒）；未设置时默认 7 天。 */
export const SUDUKU_SESSION_TTL_MS_ENV = "SUDUKU_SESSION_TTL_MS";

const TOKEN_PREFIX = "suduku-session-v1";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): Buffer | null {
  const raw = process.env[SUDUKU_SESSION_SECRET_ENV];
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  return Buffer.from(raw, "utf8");
}

function getTtlMs(): number {
  const raw = process.env[SUDUKU_SESSION_TTL_MS_ENV];
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_TTL_MS;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_TTL_MS;
  }
  return Math.floor(n);
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64urlDecodeToBuffer(s: string): Buffer | null {
  try {
    return Buffer.from(s, "base64url");
  } catch {
    return null;
  }
}

type SessionPayloadV1 = {
  v: 1;
  uid: string;
  iat: number;
  exp: number;
};

/**
 * 为已认证用户签发会话 token（供 `login` 成功路径调用）。
 *
 * @throws 若未设置 {@link SUDUKU_SESSION_SECRET_ENV}
 */
export function createSessionToken(userId: string, nowMs: number = Date.now()): string {
  const secret = getSecret();
  if (secret === null) {
    throw new Error(
      `${SUDUKU_SESSION_SECRET_ENV} is not set; cannot issue session tokens.`,
    );
  }
  const iat = nowMs;
  const exp = nowMs + getTtlMs();
  const payload: SessionPayloadV1 = { v: 1, uid: userId, iat, exp };
  const payloadStr = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(payloadStr, "utf8").digest();
  return `${TOKEN_PREFIX}.${base64urlEncode(Buffer.from(payloadStr, "utf8"))}.${base64urlEncode(sig)}`;
}

/**
 * 校验 Bearer 体中的不透明串（不含 `Bearer ` 前缀）。
 *
 * @returns 有效且未过期时返回 `userId`；否则 `null`（过期、篡改、未知格式、未配置密钥）。
 */
export function validateToken(token: string): string | null {
  const secret = getSecret();
  if (secret === null) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    return null;
  }
  const payloadBuf = base64urlDecodeToBuffer(parts[1]);
  const sigBuf = base64urlDecodeToBuffer(parts[2]);
  if (payloadBuf === null || sigBuf === null) {
    return null;
  }
  const payloadStr = payloadBuf.toString("utf8");
  const expectedSig = crypto.createHmac("sha256", secret).update(payloadStr, "utf8").digest();
  if (expectedSig.length !== sigBuf.length || !crypto.timingSafeEqual(expectedSig, sigBuf)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadStr) as unknown;
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("v" in parsed) ||
    !("uid" in parsed) ||
    !("exp" in parsed)
  ) {
    return null;
  }
  const obj = parsed as { v?: unknown; uid?: unknown; iat?: unknown; exp?: unknown };
  if (obj.v !== 1 || typeof obj.uid !== "string" || obj.uid === "") {
    return null;
  }
  if (typeof obj.exp !== "number" || !Number.isFinite(obj.exp)) {
    return null;
  }
  if (obj.exp <= Date.now()) {
    return null;
  }
  if (obj.iat !== undefined) {
    if (typeof obj.iat !== "number" || !Number.isFinite(obj.iat)) {
      return null;
    }
    // 宽松时钟偏移：签发时间不应远晚于当前（防伪造未来 token）
    if (obj.iat > Date.now() + 120_000) {
      return null;
    }
  }
  return obj.uid;
}
