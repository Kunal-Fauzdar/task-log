import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { createWorkDay } from "../src/lib/data/workday";
import { getDayName } from "../src/lib/domain/date";
import { buildWorkLogWorkbook, type ExportWorkDay } from "../src/lib/excel/export";

// Each test owns a dedicated date and its own cleanup — playwright.config.ts sets
// fullyParallel: true (see CLAUDE.md's Phase 8 lesson about shared test-data dates racing under
// parallel workers), so nothing here is shared across tests.

test("uploads a WorkLog export, previews it, and imports the new day", async ({ page }, testInfo) => {
  const testDate = new Date(Date.UTC(2099, 9, 20)); // 2099-10-20

  const workDay: ExportWorkDay = {
    date: testDate,
    checkIn: new Date(Date.UTC(2099, 9, 20, 9, 0)),
    checkOut: new Date(Date.UTC(2099, 9, 20, 17, 0)),
    breakSeconds: 1800,
    isHoliday: false,
    holidayReason: null,
    tasks: [
      {
        taskId: "T-8001",
        description: "Playwright import e2e task",
        durationSeconds: 3600,
        link: "https://example.com/T-8001",
      },
    ],
  };
  const workbook = await buildWorkLogWorkbook([workDay]);
  const filePath = testInfo.outputPath("worklog-import-new.xlsx");
  await workbook.xlsx.writeFile(filePath);

  try {
    await page.goto("/import");
    await page.locator("#import-file").setInputFiles(filePath);
    await page.getByRole("button", { name: "Upload & Preview" }).click();

    await expect(page.getByText(`2099-10-20 (${getDayName(testDate)})`)).toBeVisible();
    await expect(page.getByText("New", { exact: true })).toBeVisible();

    const confirmButton = page.getByRole("button", { name: /^Confirm Import/ });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
    await expect(page.getByText("1 day(s) imported.")).toBeVisible();

    const saved = await prisma.workDay.findUnique({
      where: { date: testDate },
      include: { tasks: true },
    });
    expect(saved?.status).toBe("COMPLETED");
    expect(saved?.tasks).toHaveLength(1);
    expect(saved?.tasks[0]).toMatchObject({ taskId: "T-8001", link: "https://example.com/T-8001" });
  } finally {
    await prisma.workDay.deleteMany({ where: { date: testDate } });
  }
});

test("flags a day that already exists as a duplicate and does not let it be re-imported", async ({
  page,
}, testInfo) => {
  const testDate = new Date(Date.UTC(2099, 9, 21)); // 2099-10-21

  try {
    await createWorkDay({ date: testDate });

    const workbook = await buildWorkLogWorkbook([
      {
        date: testDate,
        checkIn: new Date(Date.UTC(2099, 9, 21, 9, 0)),
        checkOut: new Date(Date.UTC(2099, 9, 21, 17, 0)),
        breakSeconds: 0,
        isHoliday: false,
        holidayReason: null,
        tasks: [{ taskId: "T-8002", description: "Should be skipped", durationSeconds: 3600, link: null }],
      },
    ]);
    const filePath = testInfo.outputPath("worklog-import-duplicate.xlsx");
    await workbook.xlsx.writeFile(filePath);

    await page.goto("/import");
    await page.locator("#import-file").setInputFiles(filePath);
    await page.getByRole("button", { name: "Upload & Preview" }).click();

    await expect(page.getByText("Already exists")).toBeVisible();
    const confirmButton = page.getByRole("button", { name: /^Confirm Import/ });
    await expect(confirmButton).toBeDisabled();
  } finally {
    await prisma.workDay.deleteMany({ where: { date: testDate } });
  }
});
