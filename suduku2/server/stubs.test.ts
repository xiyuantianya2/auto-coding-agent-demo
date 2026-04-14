import { describe, expect, it } from "vitest";

import { exportProgress, importProgress } from "./stubs";

describe("server stubs (export/import — task 6)", () => {
  it("exportProgress rejects until implemented", async () => {
    await expect(exportProgress("any-token")).rejects.toThrow(/not implemented/);
  });

  it("importProgress rejects until implemented", async () => {
    await expect(importProgress("any-token", "{}")).rejects.toThrow(/not implemented/);
  });
});
