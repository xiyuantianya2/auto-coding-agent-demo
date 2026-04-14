import { test, expect } from "@playwright/test";
import {
  SERVER_API_NOT_IMPLEMENTED,
  createEmptyProgressPayload,
  loadProgress,
  registerUser,
  saveProgress,
} from "@/server";

test.describe("Suduku server-api skeleton (Node-side)", () => {
  test("createEmptyProgressPayload returns empty records", () => {
    const empty = createEmptyProgressPayload();
    expect(empty.endless).toEqual({});
    expect(empty.practice).toEqual({});
    expect(empty.tutorial).toEqual({});
  });

  test("loadProgress returns empty progress placeholder", async () => {
    await expect(loadProgress("test-user")).resolves.toEqual(
      createEmptyProgressPayload(),
    );
  });

  test("registerUser and saveProgress reject with not-implemented message", async () => {
    await expect(registerUser("u", "h")).rejects.toThrow(SERVER_API_NOT_IMPLEMENTED);
    await expect(
      saveProgress("u", createEmptyProgressPayload()),
    ).rejects.toThrow(SERVER_API_NOT_IMPLEMENTED);
  });
});
