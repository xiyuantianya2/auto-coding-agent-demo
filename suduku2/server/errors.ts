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
