import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 0.0,
        functions: 0.0,
        lines: 0.0,
        statements: 0.0
      }
    }
  }
});
