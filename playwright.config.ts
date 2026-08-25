import { defineConfig, devices } from "@playwright/test";

// Configurable via PLAYWRIGHT_PORT (default 3000) — this machine runs multiple unrelated
// projects' dev servers side by side, and port 3000 isn't guaranteed to be free/ours. Defaulting
// keeps normal single-project usage unchanged.
const PORT = process.env.PLAYWRIGHT_PORT ?? "3000";
const BASE_URL = `http://localhost:${PORT}`;
const AUTH_FILE = "playwright/.auth/user.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // 5s default expect timeout occasionally isn't enough once 3 workers share one dev server —
  // observed as an intermittent flake on an assertion that reliably passes standalone.
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    // Every route requires a login now (src/proxy.ts) — this project logs in once and
    // writes the session cookie to AUTH_FILE; "chromium" depends on it and starts every test
    // already authenticated (see e2e/auth.setup.ts). auth.spec.ts deliberately runs unauthenticated
    // against a fresh context, so it's excluded here and given its own project below.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
      dependencies: ["setup"],
      testIgnore: /auth\.spec\.ts/,
    },
    {
      name: "chromium-unauthenticated",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
