/**
 * 可区分的服务端错误，供调用方按 `code` 或 `instanceof` 处理。
 */
export class UsernameConflictError extends Error {
  readonly code = "USERNAME_CONFLICT";

  constructor(message = "Username already registered") {
    super(message);
    this.name = "UsernameConflictError";
  }
}

export class InvalidPasswordError extends Error {
  readonly code = "INVALID_PASSWORD";

  constructor(message = "Password must be at least 6 characters") {
    super(message);
    this.name = "InvalidPasswordError";
  }
}

export class InvalidUsernameError extends Error {
  readonly code = "INVALID_USERNAME";

  constructor(message = "Username is required") {
    super(message);
    this.name = "InvalidUsernameError";
  }
}

/** 用户名在索引中不存在（未注册） */
export class UnknownUserError extends Error {
  readonly code = "UNKNOWN_USER";

  constructor(message = "Unknown username") {
    super(message);
    this.name = "UnknownUserError";
  }
}

/** 密码与存储哈希不匹配 */
export class WrongPasswordError extends Error {
  readonly code = "WRONG_PASSWORD";

  constructor(message = "Wrong password") {
    super(message);
    this.name = "WrongPasswordError";
  }
}

/** 会话令牌缺失、格式无效或已失效 */
export class InvalidTokenError extends Error {
  readonly code = "INVALID_TOKEN";

  constructor(message = "Invalid or expired session token") {
    super(message);
    this.name = "InvalidTokenError";
  }
}
