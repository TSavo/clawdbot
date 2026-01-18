import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json"],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
      exclude: [
        "src/**/*.test.ts",
        "dist/**",
        "node_modules/**",
      ],
    },
  },
});
