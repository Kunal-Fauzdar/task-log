import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";

const TEST_DATE = new Date("2099-06-10");
// Two dates inside the last 12 months (the month dropdown's range) but not the current month, so
// their hours only show up once each month is picked. Kept well clear of "today" (2026-09-01 in
// this project's fixed clock) and of the 2099 fixture above.
const PICKER_MONTH_DATE = new Date("2026-07-15");
const PICKER_MONTH_DATE_2 = new Date("2026-06-12");

test.afterEach(async () => {
  await prisma.workDay.deleteMany({
    where: { date: { in: [TEST_DATE, PICKER_MONTH_DATE, PICKER_MONTH_DATE_2] } },
  });
});

test("dashboard shows today's work, statistics, and recent work days", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Today's Work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(page.getByText("Today's hours")).toBeVisible();
  await expect(page.getByText("Tasks · last 30 days")).toBeVisible();
  await expect(page.getByText("Completed · last 30 days")).toBeVisible();
  await expect(page.getByLabel("Month")).toBeVisible();
  await expect(page.getByText("Total hours")).toBeVisible();
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

test("the month dropdown re-computes Total hours on every pick", async ({ page }) => {
  await prisma.workDay.createMany({
    data: [
      {
        date: PICKER_MONTH_DATE,
        checkIn: new Date(Date.UTC(2026, 6, 15, 9, 0, 0)),
        checkOut: new Date(Date.UTC(2026, 6, 15, 15, 0, 0)), // 6h net
        status: "COMPLETED",
      },
      {
        date: PICKER_MONTH_DATE_2,
        checkIn: new Date(Date.UTC(2026, 5, 12, 9, 0, 0)),
        checkOut: new Date(Date.UTC(2026, 5, 12, 12, 0, 0)), // 3h net
        status: "COMPLETED",
      },
    ],
  });

  await page.goto("/dashboard");
  const total = page.getByTestId("month-total-hours");
  await expect(total).not.toHaveText("6:00:00");

  await page.getByLabel("Month").selectOption("2026-07");
  await expect(page).toHaveURL(/month=2026-07/);
  await expect(total).toHaveText("6:00:00");

  // Second pick: only the query string changes — this is the case that used to serve a stale total.
  await page.getByLabel("Month").selectOption("2026-06");
  await expect(page).toHaveURL(/month=2026-06/);
  await expect(total).toHaveText("3:00:00");

  // And back again.
  await page.getByLabel("Month").selectOption("2026-07");
  await expect(total).toHaveText("6:00:00");
});
