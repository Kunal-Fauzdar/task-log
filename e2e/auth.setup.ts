import "dotenv/config";
import { test as setup, expect } from "@playwright/test";

import { e2eCredentials, ensureE2ESkills, getOrCreateE2EUser } from "./helpers";

// Every route is gated behind a login (src/proxy.ts) — this setup project runs once, ensures a
// shared e2e account exists, logs in, and saves the session cookie to a file every other project
// reuses via `storageState` (see playwright.config.ts).
const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const user = await getOrCreateE2EUser();
  await ensureE2ESkills(user.id);
  const { email, password } = e2eCredentials();

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.context().storageState({ path: authFile });
});
