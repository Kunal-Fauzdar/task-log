import "dotenv/config";
import { randomUUID } from "node:crypto";

import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { e2eCredentials, getOrCreateE2EUser } from "./helpers";

// Runs on the "chromium-unauthenticated" project (playwright.config.ts) — a fresh browser
// context with no session cookie, unlike every other spec which reuses the logged-in
// storageState from e2e/auth.setup.ts.

test("visiting a protected page without a session redirects to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "WorkLog Manager" })).toBeVisible();
});

test("an unauthenticated API request gets 401 JSON, not a redirect", async ({ page }) => {
  const response = await page.request.get("/api/export?type=day&date=2026-01-01");
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: "Unauthorized" });
});

test("wrong password shows an error and does not grant access", async ({ page }) => {
  await getOrCreateE2EUser();
  const { email } = e2eCredentials();

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("registering creates an account, lands on the dashboard, and logout revokes access", async ({
  page,
}) => {
  const email = `e2e-reg-${randomUUID()}@worklog.test`;
  try {
    await page.goto("/register");
    await page.getByLabel("Display name").fill("Registration Test");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("register-me-123");
    await page.getByLabel("Confirm password").fill("register-me-123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Today's Work" })).toBeVisible();

    await page.getByRole("button", { name: "Log Out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});

test("logging in with the correct password works and logout revokes access", async ({ page }) => {
  await getOrCreateE2EUser();
  const { email, password } = e2eCredentials();

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/login/);
});
