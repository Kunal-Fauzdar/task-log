import { test, expect } from "@playwright/test";

test("home page redirects to dashboard and shows nav", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Today's Work" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const label of ["Work Log", "Calendar", "Skills", "Reports", "Export", "Settings"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
});

test("clicking a nav link navigates to that page", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Skills" }).click();
  await expect(page).toHaveURL(/\/skills$/);
  await expect(page.getByRole("heading", { name: "SkillMap" })).toBeVisible();
});
