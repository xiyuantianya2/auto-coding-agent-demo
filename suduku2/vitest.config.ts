import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "content/**/*.test.ts",
      "server/**/*.test.ts",
      "e2e/**/*.test.ts",
    ],
    exclude: [
      "e2e/runAcceptanceSuite.gate.integration-qa.test.ts",
    ],
    passWithNoTests: true,
    testTimeout: 15_000,
  },
});
