/* eslint-disable @typescript-eslint/no-unused-vars -- public API placeholders; params match module contract */

const STUB_MSG = "suduku2/server: not implemented (server-api module pending)";

export async function exportProgress(token: string): Promise<string> {
  throw new Error(STUB_MSG);
}

export async function importProgress(token: string, json: string): Promise<void> {
  throw new Error(STUB_MSG);
}
