import { describe, expect, it } from "vitest";

import { getProgress } from "./stubs";

describe("server stubs", () => {
  it("getProgress rejects until implemented", async () => {
    await expect(getProgress("any-token")).rejects.toThrow(/not implemented/);
  });
});
