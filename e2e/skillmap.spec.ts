import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";

const TEST_SKILL_NAME = "__e2e__ Rust";

test.afterEach(async () => {
  await prisma.skill.deleteMany({ where: { name: TEST_SKILL_NAME } });
});

test("add a skill, edit its proficiency, see history, then delete it", async ({ page }) => {
  await page.goto("/skills");

  // Add
  await page.getByRole("button", { name: "+ Add Skill" }).click();
  await page.getByLabel("Skill name").fill(TEST_SKILL_NAME);
  await page.getByLabel("Proficiency (%)").fill("40");
  await page.getByRole("button", { name: "Save" }).click();

  // Two levels up from the heading is the card's own bordered container — a bare
  // `locator("div", { has })` matches every ancestor div, including the whole category
  // section (which "has" the heading as a descendant too), causing ambiguous matches.
  const card = page.getByRole("heading", { name: TEST_SKILL_NAME }).locator("xpath=../..");
  await expect(card.getByText("40%")).toBeVisible();

  // Edit proficiency -> crosses into the "More Than 70%" band and records history
  await card.getByRole("button", { name: `Edit ${TEST_SKILL_NAME}` }).click();
  await page.getByLabel("Proficiency (%)").fill("85");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(card.getByText("85%")).toBeVisible();
  await expect(page.getByRole("heading", { name: "More Than 70%" })).toBeVisible();

  await card.getByText(/Show history/).click();
  await expect(card.getByText("40% → 85% (+45%)")).toBeVisible();

  // Delete
  await card.getByRole("button", { name: `Delete ${TEST_SKILL_NAME}` }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByRole("heading", { name: TEST_SKILL_NAME })).toHaveCount(0);
});

test("search filters the skill list", async ({ page }) => {
  await page.goto("/skills");

  await page.getByLabel("Search skills").fill("react");

  await expect(page.getByRole("heading", { name: "React.js", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Python", exact: true })).toHaveCount(0);
});
