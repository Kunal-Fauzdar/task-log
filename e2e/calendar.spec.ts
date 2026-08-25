import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { getLocalMonth } from "../src/lib/domain/date";

test("calendar redirects to the current month and supports prev/next navigation", async ({ page }) => {
  await page.goto("/calendar");

  const currentMonth = getLocalMonth(new Date());
  await expect(page).toHaveURL(new RegExp(`/calendar/${currentMonth}$`));

  await page.getByRole("link", { name: "← Prev" }).click();
  await expect(page).not.toHaveURL(new RegExp(`/calendar/${currentMonth}$`));

  await page.getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL(new RegExp(`/calendar/${currentMonth}$`));
});

test("a work day in the grid links to its Work Log page", async ({ page }) => {
  const testDate = new Date("2099-08-15");

  await prisma.workDay.create({
    data: {
      date: testDate,
      checkIn: new Date(Date.UTC(2099, 7, 15, 9, 0, 0)),
      checkOut: new Date(Date.UTC(2099, 7, 15, 17, 0, 0)),
      status: "COMPLETED",
    },
  });

  try {
    await page.goto("/calendar/2099-08");
    await expect(page.getByRole("heading", { name: "August 2099" })).toBeVisible();

    await page.getByRole("link", { name: "15" }).click();
    await expect(page).toHaveURL(/\/worklog\/2099-08-15$/);
  } finally {
    await prisma.workDay.deleteMany({ where: { date: testDate } });
  }
});
