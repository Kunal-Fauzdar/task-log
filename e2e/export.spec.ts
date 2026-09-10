import path from "node:path";

import ExcelJS from "exceljs";
import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { createWorkDay } from "../src/lib/data/workday";
import { createTask } from "../src/lib/data/task";
import { createProject } from "../src/lib/data/project";
import { e2eUserId } from "./helpers";

const TEST_DATE = new Date("2099-11-05");
const PROJECT_NAME = "__e2e__ Export Suffix Project";

test.afterEach(async () => {
  const userId = await e2eUserId();
  await prisma.workDay.deleteMany({ where: { userId, date: TEST_DATE } });
  await prisma.project.deleteMany({ where: { userId, name: PROJECT_NAME } });
});

test("custom range export downloads a real xlsx file with the logged task in it", async ({
  page,
}, testInfo) => {
  const workDay = await createWorkDay({ userId: await e2eUserId(), date: TEST_DATE });
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

test("all-projects export tags each task's Task List cell with its project name", async ({
  page,
}, testInfo) => {
  const userId = await e2eUserId();
  const project = await createProject({ userId, name: PROJECT_NAME });
  const workDay = await createWorkDay({ userId, date: TEST_DATE });
  await createTask({
    workDayId: workDay.id,
    taskId: "T-6100",
    description: "Task filed under a project",
    durationSeconds: 3600,
    projectId: project.id,
  });

  await page.goto("/export");
  await page.locator("#export-from").fill("2099-11-05");
  await page.locator("#export-to").fill("2099-11-05");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export Range" }).click(),
  ]);

  const savedPath = path.join(testInfo.outputDir, download.suggestedFilename());
  await download.saveAs(savedPath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(savedPath);
  const sheet = workbook.worksheets[0];

  expect(sheet.getRow(2).getCell(7).value).toBe(`Task filed under a project (${PROJECT_NAME})`);
});
