import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests cover the PURE pricing logic (session clock, extended fold
// math, day-change reference) — the parts where a silent regression would
// quietly misprice the family's money. Next-specific modules are stubbed:
// unstable_cache is identity in tests, so the wrapped fetchers run bare.
export default defineConfig({
  resolve: {
    alias: {
      "next/cache": path.resolve(__dirname, "tests/stubs/next-cache.ts"),
      "@": path.resolve(__dirname),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
