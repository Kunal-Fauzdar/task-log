import "dotenv/config";
import { test, expect } from "@playwright/test";

// Runs on the "chromium-unauthenticated" project (playwright.config.ts) — a fresh browser
// context with no session cookie, unlike every other spec which reuses the logged-in
// storageState from e2e/auth.setup.ts.

test("visiting a protected page without a session redirects to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "WorkLog Manager" })).toBeVisible();
});

test("an unauthenticated API request gets 401 JSON, not a redirect", async ({ request }) => {
  const response = await request.get("/api/export?type=day&date=2026-01-01");
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: "Unauthorized" });
});

test("wrong password shows an error and does not grant access", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign In" }).click();
  // Next.js's own route announcer (`#__next-route-announcer__`) also has role="alert", so scope
  // to the login form's error text specifically rather than getByRole("alert") alone.
  await expect(page.getByText("Incorrect password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("correct password logs in, and logging out revokes access again", async ({ page }) => {
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) throw new Error("E2E_TEST_PASSWORD is not set in .env");

  await page.goto("/login");
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
