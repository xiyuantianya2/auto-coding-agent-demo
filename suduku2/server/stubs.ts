/* eslint-disable @typescript-eslint/no-unused-vars -- public API placeholders; params match module contract */
import type { EndlessGlobalState, UserProgress } from "./types";

const STUB_MSG = "suduku2/server: not implemented (server-api module pending)";

export async function login(
  username: string,
  password: string,
): Promise<{ token: string }> {
  throw new Error(STUB_MSG);
}

export async function getProgress(
  token: string,
): Promise<UserProgress & { global: EndlessGlobalState }> {
  throw new Error(STUB_MSG);
}

export async function saveProgress(
  token: string,
  patch: Partial<UserProgress>,
): Promise<void> {
  throw new Error(STUB_MSG);
}

export async function exportProgress(token: string): Promise<string> {
  throw new Error(STUB_MSG);
}

export async function importProgress(token: string, json: string): Promise<void> {
  throw new Error(STUB_MSG);
}
