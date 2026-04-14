import { describe, expect, it } from "vitest";

import { register } from "./stubs";

describe("server stubs", () => {
  it("register rejects until implemented", async () => {
    await expect(register("u", "secret12")).rejects.toThrow(/not implemented/);
  });
});
