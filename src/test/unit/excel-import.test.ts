import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { EXCEL_HEADERS, buildWorkLogWorkbook, type ExportWorkDay } from "@/lib/excel/export";
import { parseWorkLogWorkbook } from "@/lib/excel/import";

function makeWorkDay(overrides: Partial<ExportWorkDay> = {}): ExportWorkDay {
  return {
    date: new Date(Date.UTC(2026, 7, 24)), // Monday, August 24, 2026
    checkIn: new Date(Date.UTC(2026, 7, 24, 10, 10)),
    checkOut: new Date(Date.UTC(2026, 7, 24, 19, 25)),
    breakSeconds: 30 * 60,
    isHoliday: false,
    holidayReason: null,
    tasks: [],
    ...overrides,
  };
}

async function bufferFrom(workDays: ExportWorkDay[]): Promise<Buffer> {
  const workbook = await buildWorkLogWorkbook(workDays);
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

describe("parseWorkLogWorkbook — round trip against our own export", () => {
  it("recovers a single-task day exactly", async () => {
    const buffer = await bufferFrom([
      makeWorkDay({
        tasks: [
          {
            taskId: "T-1039",
            description: "Fixed the bug",
            durationSeconds: 4 * 3600,
            link: "https://example.com/T-1039",
          },
        ],
      }),
    ]);

    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(true);
    if (!preview.valid) return;

    expect(preview.rowErrors).toEqual([]);
    expect(preview.groups).toHaveLength(1);
    const [group] = preview.groups;
    expect(group.date).toBe("2026-08-24");
    expect(group.day).toBe("Monday");
    expect(group.checkIn).toBe("10:10");
    expect(group.checkOut).toBe("19:25");
    expect(group.breakSeconds).toBe(30 * 60);
    expect(group.errors).toEqual([]);
    expect(group.tasks).toEqual([
      {
        rowNumber: 2,
        taskId: "T-1039",
        description: "Fixed the bug",
        durationSeconds: 4 * 3600,
        link: "https://example.com/T-1039",
      },
    ]);
  });

  it("recovers multiple tasks on one day as a single group", async () => {
    const buffer = await bufferFrom([
      makeWorkDay({
        tasks: [
          { taskId: "T-1", description: "First", durationSeconds: 3600, link: null },
          { taskId: "T-2", description: "Second", durationSeconds: 1800, link: null },
        ],
      }),
    ]);

    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(true);
    if (!preview.valid) return;

    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0].tasks).toHaveLength(2);
    expect(preview.groups[0].tasks.map((t) => t.taskId)).toEqual(["T-1", "T-2"]);
  });

  it("recovers a holiday row as its own group with no tasks", async () => {
    const buffer = await bufferFrom([
      makeWorkDay({
        checkIn: null,
        checkOut: null,
        breakSeconds: 0,
        isHoliday: true,
        holidayReason: "Independence Day",
      }),
    ]);

    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(true);
    if (!preview.valid) return;

    expect(preview.groups).toHaveLength(1);
    const [group] = preview.groups;
    expect(group.isHoliday).toBe(true);
    expect(group.holidayReason).toBe("Independence Day");
    expect(group.checkIn).toBeNull();
    expect(group.tasks).toEqual([]);
  });

  it("recovers a day with zero tasks", async () => {
    const buffer = await bufferFrom([makeWorkDay({ tasks: [] })]);
    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(true);
    if (!preview.valid) return;

    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0].tasks).toEqual([]);
    expect(preview.groups[0].errors).toEqual([]);
  });

  it("recovers multiple days in order, mixing normal/holiday/empty", async () => {
    const buffer = await bufferFrom([
      makeWorkDay({
        date: new Date(Date.UTC(2026, 7, 24)),
        tasks: [{ taskId: "T-1", description: "Work", durationSeconds: 3600, link: null }],
      }),
      makeWorkDay({
        date: new Date(Date.UTC(2026, 7, 25)),
        isHoliday: true,
        holidayReason: "Company holiday",
        checkIn: null,
        checkOut: null,
      }),
      makeWorkDay({ date: new Date(Date.UTC(2026, 7, 26)), tasks: [] }),
    ]);

    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(true);
    if (!preview.valid) return;

    expect(preview.groups.map((g) => g.date)).toEqual(["2026-08-24", "2026-08-25", "2026-08-26"]);
    expect(preview.groups[1].isHoliday).toBe(true);
  });
});

describe("parseWorkLogWorkbook — header validation", () => {
  it("rejects a file whose header row doesn't match", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(["Date", "Day", "Wrong", "Header", "Row"]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(false);
    if (preview.valid) return;
    expect(preview.headerError).toContain(EXCEL_HEADERS[0]);
  });
});

describe("parseWorkLogWorkbook — invalid row reporting", () => {
  it("reports a group error for an invalid Task ID", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow([...EXCEL_HEADERS]);
    sheet.addRow(["08/24/2026", "Monday", "10:10 AM", "7:25 PM", "0:30:00", "not-a-valid-id", "desc", "1:00:00", ""]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(true);
    if (!preview.valid) return;
    expect(preview.groups[0].errors.some((e) => e.includes("Invalid Task ID"))).toBe(true);
  });

  it("reports a group error when Check Out is before Check In", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow([...EXCEL_HEADERS]);
    sheet.addRow(["08/24/2026", "Monday", "5:00 PM", "9:00 AM", "0:00:00", "T-1", "desc", "1:00:00", ""]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(true);
    if (!preview.valid) return;
    expect(preview.groups[0].errors.some((e) => e.includes("Check Out must be after Check In"))).toBe(
      true,
    );
  });

  it("reports a row error (not a group error) for an unparseable date", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow([...EXCEL_HEADERS]);
    sheet.addRow(["not-a-date", "Monday", "10:10 AM", "7:25 PM", "0:30:00", "T-1", "desc", "1:00:00", ""]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(true);
    if (!preview.valid) return;
    expect(preview.groups).toEqual([]);
    expect(preview.rowErrors).toHaveLength(1);
    expect(preview.rowErrors[0].rowNumber).toBe(2);
  });

  it("reports a group error for an invalid Link", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow([...EXCEL_HEADERS]);
    sheet.addRow([
      "08/24/2026",
      "Monday",
      "10:10 AM",
      "7:25 PM",
      "0:30:00",
      "T-1",
      "desc",
      "1:00:00",
      "javascript:alert(1)",
    ]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const preview = await parseWorkLogWorkbook(buffer);
    expect(preview.valid).toBe(true);
    if (!preview.valid) return;
    expect(preview.groups[0].errors.some((e) => e.includes("Link must start with"))).toBe(true);
  });
});
