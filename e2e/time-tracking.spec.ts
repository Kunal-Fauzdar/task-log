import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { getLocalISODate } from "../src/lib/domain/date";

// Start/End Work quick-actions are only offered for *today's* page (see
// src/hooks/use-is-today.ts), so this test must use the real current date, not a fixed
// far-future fixture like the other e2e/integration tests. Clean up afterward regardless.
const TODAY_PARAM = getLocalISODate(new Date());

test.afterEach(async () => {
  const workDay = await prisma.workDay.findUnique({ where: { date: new Date(`${TODAY_PARAM}T00:00:00.000Z`) } });
  if (workDay) {
    await prisma.task.deleteMany({ where: { workDayId: workDay.id } });
    await prisma.workDay.update({
      where: { id: workDay.id },
      data: { checkIn: null, checkOut: null, breakSeconds: 0, breakStartedAt: null, status: "NOT_STARTED" },
    });
  }
});

test("start work, break, task timer, end work, and see net work duration", async ({ page }) => {
  await page.goto(`/worklog/${TODAY_PARAM}`);

  await expect(page.getByText("No work recorded")).toBeVisible();
  await page.getByRole("button", { name: "Start Work" }).click();
  await expect(page.getByText("Currently working")).toBeVisible();
  await expect(page.getByText("—").first()).toBeVisible(); // Check Out still unset

  // Break
  await page.getByRole("button", { name: "Start Break" }).click();
  await expect(page.getByRole("button", { name: "End Break" })).toBeVisible();
  await page.getByRole("button", { name: "End Break" }).click();
  await expect(page.getByRole("button", { name: "Start Break" })).toBeVisible();

  // Add a task and run its timer
  await page.getByRole("button", { name: "+ Add Task" }).click();
  await page.getByLabel("Task ID").fill("T-3001");
  await page.getByLabel("Task description").fill("E2E timer test");
  await page.getByLabel("Duration (H:MM:SS)").fill("0:00:00");
  await page.getByRole("button", { name: "Save" }).click();

  const row = page.getByRole("row", { name: /T-3001/ });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Start timer for T-3001" }).click();
  await expect(row.getByRole("button", { name: "Pause timer for T-3001" })).toBeVisible();
  await page.waitForTimeout(1500);
  await row.getByRole("button", { name: "Pause timer for T-3001" }).click();
  await expect(row.getByRole("button", { name: "Resume timer for T-3001" })).toBeVisible();

  // End work
  await page.getByRole("button", { name: "End Work" }).click();
  await expect(page.getByText("Work completed")).toBeVisible();
  await expect(page.getByText("No work recorded")).toHaveCount(0);

  // Net Work Duration should now show a real H:MM:SS value, not "—"
  const netWorkDuration = page.locator("dt", { hasText: "Net Work Duration" }).locator("..").locator("dd");
  await expect(netWorkDuration).toHaveText(/^\d+:\d{2}:\d{2}$/);
});
