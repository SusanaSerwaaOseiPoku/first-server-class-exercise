import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    setupFiles: ["./test/setup.js"],
    fileParallelism: false,
    testTimeout: 15000,
    include: ["test/**/*.test.js"],
  },
});
