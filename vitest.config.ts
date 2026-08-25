import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    // Integration tests use the real Neon driver adapter (WebSocket-based). jsdom's own
    // WebSocket/Event globals collide with it (cross-realm `instanceof Event` failures that
    // hang queries until they time out) — those files opt back into the `node` environment
    // via a `// @vitest-environment node` comment at the top of the file instead.
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/unit/**/*.test.{ts,tsx}", "src/test/integration/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
