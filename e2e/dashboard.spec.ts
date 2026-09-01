import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";

const TEST_DATE = new Date("2099-06-10");

test.afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: TEST_DATE } });
});

test("dashboard shows today's work, statistics, and recent work days", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Today's Work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(page.getByText("Today's hours")).toBeVisible();
  await expect(page.getByText("Last 7 days")).toBeVisible();
  await expect(page.getByText("Last 30 days")).toBeVisible();
  await expect(page.getByText("Tasks · last 30 days")).toBeVisible();
  await expect(page.getByText("Completed · last 30 days")).toBeVisible();
  await expect(page.getByText("Avg. task duration")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Work Days" })).toBeVisible();
});

test("a completed work day appears in Recent Work Days and links to its Work Log", async ({ page }) => {
  const workDay = await prisma.workDay.create({
    data: {
      date: TEST_DATE,
      checkIn: new Date(Date.UTC(2099, 5, 10, 9, 0, 0)),
      checkOut: new Date(Date.UTC(2099, 5, 10, 17, 0, 0)),
      status: "COMPLETED",
    },
  });
  await prisma.task.create({
    data: { workDayId: workDay.id, taskId: "T-8001", description: "Dashboard e2e task", order: 0 },
  });

  await page.goto("/dashboard");

  const row = page.getByRole("row", { name: /2099-06-10/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("Work completed")).toBeVisible();

  await row.getByRole("link", { name: "2099-06-10" }).click();
  await expect(page).toHaveURL(/\/worklog\/2099-06-10$/);
});
