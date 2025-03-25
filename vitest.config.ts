import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        branches: 0.1,
        functions: 0.1,
        lines: 0.1,
        statements: 0.1,
      },
    },
  },
});
