import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { parseDateOnly } from "../src/lib/domain/date";

const TEST_DATE_PARAM = "2099-09-01";
const TEST_DATE = parseDateOnly(TEST_DATE_PARAM);

test.afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: TEST_DATE } });
});

test("associating a skill with a task shows it as a badge and persists on edit", async ({ page }) => {
  await page.goto(`/worklog/${TEST_DATE_PARAM}`);

  await page.getByRole("button", { name: "+ Add Task" }).click();
  await page.getByLabel("Task ID").fill("T-7001");
  await page.getByLabel("Task description").fill("Task with a skill");
  await page.getByLabel("Duration (H:MM:SS)").fill("1:00:00");
  // "React.js" is one of the 25 seeded skills (Phase 2) — always present.
  await page.getByRole("checkbox", { name: "React.js" }).check();
  await page.getByRole("button", { name: "Save" }).click();

  const row = page.getByRole("row", { name: /T-7001/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("React.js")).toBeVisible();

  // Edit dialog pre-selects the associated skill.
  await row.getByRole("button", { name: "Edit T-7001" }).click();
  await expect(page.getByRole("checkbox", { name: "React.js" })).toBeChecked();

  // Unchecking and saving removes the association.
  await page.getByRole("checkbox", { name: "React.js" }).uncheck();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(row.getByText("React.js")).toHaveCount(0);
});
