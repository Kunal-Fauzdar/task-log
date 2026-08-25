import path from "node:path";

import ExcelJS from "exceljs";
import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { createWorkDay } from "../src/lib/data/workday";
import { createTask } from "../src/lib/data/task";

const TEST_DATE = new Date("2099-11-05");

test.afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: TEST_DATE } });
});

test("custom range export downloads a real xlsx file with the logged task in it", async ({
  page,
}, testInfo) => {
  const workDay = await createWorkDay({ date: TEST_DATE });
  await createTask({
    workDayId: workDay.id,
    taskId: "T-6001",
    description: "Playwright export e2e task",
    durationSeconds: 3600,
    link: "https://example.com/T-6001",
  });

  await page.goto("/export");

  await page.locator("#export-from").fill("2099-11-05");
  await page.locator("#export-to").fill("2099-11-05");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export Range" }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("WorkLog_2099-11-05_to_2099-11-05.xlsx");

  const savedPath = path.join(testInfo.outputDir, download.suggestedFilename());
  await download.saveAs(savedPath);

  // This is the "actually open the file back up" check spec §29 requires — not just "the
  // download happened."
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(savedPath);
  const sheet = workbook.worksheets[0];

  expect(sheet.getRow(1).getCell(1).value).toBe("Date");
  expect(sheet.getRow(2).getCell(6).value).toBe("T-6001");
  expect(sheet.getRow(2).getCell(9).value).toMatchObject({
    hyperlink: "https://example.com/T-6001",
  });
});
