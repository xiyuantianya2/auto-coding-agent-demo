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
    include: ["lib/**/*.test.ts", "content/**/*.test.ts", "server/**/*.test.ts"],
    passWithNoTests: true,
    /** `generatePuzzle` + `verifyUniqueSolution` 在部分环境下可略超 5s；避免误杀。 */
    testTimeout: 15_000,
  },
});
