import { describe, expect, it } from "vitest";

import { login } from "./stubs";

describe("server stubs", () => {
  it("login rejects until implemented", async () => {
    await expect(login("u", "secret12")).rejects.toThrow(/not implemented/);
  });
});
