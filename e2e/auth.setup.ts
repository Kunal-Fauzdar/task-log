import "dotenv/config";
import { test as setup, expect } from "@playwright/test";

// Every route is gated behind a login now (src/proxy.ts) — this setup project runs once,
// logs in, and saves the resulting session cookie to a file every other project reuses via
// `storageState` (see playwright.config.ts), so individual specs don't each need their own
// login step.
const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) {
    throw new Error(
      "E2E_TEST_PASSWORD is not set in .env — it must match the plaintext password whose " +
        "bcrypt hash is in AUTH_PASSWORD_HASH (see scripts/hash-password.ts).",
    );
  }

  await page.goto("/login");
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.context().storageState({ path: authFile });
});
