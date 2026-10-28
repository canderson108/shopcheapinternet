import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // "server-only" throws outside React Server Components; tests run services directly.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Integration tests share one Postgres database: run files sequentially.
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
