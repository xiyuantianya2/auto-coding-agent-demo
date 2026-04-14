import path from "node:path";

/** 用户数据目录相对数据根的片段：`users/<userId>/`。 */
export const USERS_SEGMENT = "users";

export const USER_FILES = {
  profile: "profile.json",
  credentials: "credentials.json",
  progress: "progress.json",
} as const;

const USER_ID_FORBIDDEN = /[/\\]|\.\./;

export class InvalidUserIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUserIdError";
  }
}

/**
 * 校验 `userId` 可用于单一路径段，防止路径穿越。
 * 允许字母数字、`-`、`_`、`.`（不含路径分隔符与 `..`）。
 */
export function assertSafeUserId(userId: string): void {
  if (userId === "" || USER_ID_FORBIDDEN.test(userId)) {
    throw new InvalidUserIdError(
      "userId must be non-empty and must not contain path separators or '..'",
    );
  }
}

export function getUserDir(dataRoot: string, userId: string): string {
  assertSafeUserId(userId);
  return path.join(dataRoot, USERS_SEGMENT, userId);
}

export function getUserProgressPath(dataRoot: string, userId: string): string {
  return path.join(getUserDir(dataRoot, userId), USER_FILES.progress);
}
