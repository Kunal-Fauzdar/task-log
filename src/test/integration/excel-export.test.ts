// @vitest-environment node
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createWorkDay, listWorkDays } from "@/lib/data/workday";
import { createTask } from "@/lib/data/task";
import { buildWorkLogWorkbook } from "@/lib/excel/export";

const TEST_DATE_A = new Date("2099-10-01");
const TEST_DATE_B = new Date("2099-10-02");

afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: { in: [TEST_DATE_A, TEST_DATE_B] } } });
});

describe("Excel export — real database data end to end", () => {
  it("exports a real WorkDay with real tasks, and the file reads back correctly", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    await prisma.workDay.update({
      where: { id: workDay.id },
      data: {
        checkIn: new Date(Date.UTC(2099, 9, 1, 10, 10, 0)),
        checkOut: new Date(Date.UTC(2099, 9, 1, 19, 25, 0)),
        breakSeconds: 1800,
        status: "COMPLETED",
      },
    });
    await createTask({
      workDayId: workDay.id,
      taskId: "T-1039",
      description: "Completed add finisher name and phone number in all services page.",
      durationSeconds: 4 * 3600,
      order: 0,
    });
    await createTask({
      workDayId: workDay.id,
      taskId: "T-1219",
      description: "Started sonchi guest panel for sorting host card based on latest date.",
      durationSeconds: 4.5 * 3600,
      link: "https://example.com/T-1219",
      order: 1,
    });

    const workDays = await listWorkDays({ from: TEST_DATE_A, to: TEST_DATE_A });
    const workbook = await buildWorkLogWorkbook(workDays, [1, 2, 3, 4, 5]);
    const buffer = await workbook.xlsx.writeBuffer();

    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = reloaded.worksheets[0];

    expect(sheet.rowCount).toBe(4); // header + 2 tasks + totals
    expect(sheet.getRow(2).getCell(1).value).toBe("10/01/2099");
    expect(sheet.getRow(2).getCell(3).value).toBe("10:10 AM");
    expect(sheet.getRow(2).getCell(4).value).toBe("7:25 PM");
    expect(sheet.getRow(2).getCell(5).value).toBe("0:30:00");
    expect(sheet.getRow(2).getCell(6).value).toBe("T-1039");
    expect(sheet.getRow(3).getCell(6).value).toBe("T-1219");
    expect(sheet.getRow(3).getCell(9).value).toMatchObject({
      hyperlink: "https://example.com/T-1219",
    });
    // Date/Day/Check In/Check Out/Break merged across both task rows.
    expect(sheet.getCell(3, 1).isMerged).toBe(true);
  });

  it("exports a real multi-day range spanning a holiday", async () => {
    const workDay1 = await createWorkDay({ date: TEST_DATE_A });
    await createTask({ workDayId: workDay1.id, taskId: "T-1", description: "Day one", order: 0 });

    const workDay2 = await createWorkDay({ date: TEST_DATE_B });
    await prisma.workDay.update({
      where: { id: workDay2.id },
      data: { dayType: "HOLIDAY", dayNote: "Test Holiday", status: "HOLIDAY" },
    });

    const workDays = await listWorkDays({ from: TEST_DATE_A, to: TEST_DATE_B });
    const workbook = await buildWorkLogWorkbook(workDays, [1, 2, 3, 4, 5]);
    const buffer = await workbook.xlsx.writeBuffer();

    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = reloaded.worksheets[0];

    expect(sheet.rowCount).toBe(4); // header + day1 task row + holiday row + totals
    expect(sheet.getRow(3).getCell(3).value).toBe("HOLIDAY (Test Holiday)");
  });
});
