import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { EXCEL_HEADERS, buildWorkLogWorkbook, type ExportWorkDay } from "@/lib/excel/export";

const MON_FRI = [1, 2, 3, 4, 5];

// "The browser downloaded a file" is never sufficient (spec §29) — every test here writes the
// workbook to a real buffer and reads it back with a *fresh* ExcelJS instance, asserting on
// what actually got persisted to the file, not just what we told the in-memory model to do.
async function buildAndReload(workDays: ExportWorkDay[], workingDays: number[] = MON_FRI) {
  const workbook = await buildWorkLogWorkbook(workDays, workingDays);
  const buffer = await workbook.xlsx.writeBuffer();

  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = reloaded.worksheets[0];
  return { buffer, sheet };
}

function makeWorkDay(overrides: Partial<ExportWorkDay> = {}): ExportWorkDay {
  return {
    date: new Date(Date.UTC(2026, 7, 24)), // Monday, August 24, 2026
    checkIn: new Date(Date.UTC(2026, 7, 24, 10, 10)),
    checkOut: new Date(Date.UTC(2026, 7, 24, 19, 25)),
    breakSeconds: 30 * 60,
    dayType: "WORKING",
    dayNote: null,
    tasks: [],
    ...overrides,
  };
}

// Every export now ends with a bold TOTAL row (sum of all task durations). The last data row is
// therefore sheet.rowCount - 1.
function lastDataRow(sheet: ExcelJS.Worksheet) {
  return sheet.rowCount - 1;
}

describe("buildWorkLogWorkbook — headers", () => {
  it("has the exact headers in the exact order", async () => {
    const { sheet } = await buildAndReload([]);
    const headerRow = sheet.getRow(1).values as unknown[];
    // ExcelJS row.values is 1-indexed with a leading empty slot.
    expect(headerRow.slice(1)).toEqual([...EXCEL_HEADERS]);
  });

  it("header row is bold and frozen", async () => {
    const { sheet } = await buildAndReload([]);
    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });
});

describe("buildWorkLogWorkbook — a day with multiple tasks", () => {
  it("writes one row per task, with the day's fields repeated on the master row", async () => {
    const workDay = makeWorkDay({
      tasks: [
        { taskId: "T-1039", description: "Task one", durationSeconds: 4 * 3600, link: null },
        { taskId: "T-1219", description: "Task two", durationSeconds: 4.5 * 3600, link: null },
      ],
    });
    const { sheet } = await buildAndReload([workDay]);

    expect(sheet.rowCount).toBe(4); // header + 2 task rows + totals
    expect(sheet.getRow(2).getCell(6).value).toBe("T-1039");
    expect(sheet.getRow(3).getCell(6).value).toBe("T-1219");
    expect(sheet.getRow(2).getCell(1).value).toBe("08/24/2026");
    expect(sheet.getRow(2).getCell(2).value).toBe("Monday");
  });

  it("merges the Date/Day/Check In/Check Out/Break columns across the task rows", async () => {
    const workDay = makeWorkDay({
      tasks: [
        { taskId: "T-1", description: "A", durationSeconds: 3600, link: null },
        { taskId: "T-2", description: "B", durationSeconds: 3600, link: null },
      ],
    });
    const { sheet } = await buildAndReload([workDay]);

    for (let col = 1; col <= 5; col++) {
      expect(sheet.getCell(3, col).isMerged).toBe(true);
      expect(sheet.getCell(3, col).master.address).toBe(sheet.getCell(2, col).address);
    }
    // TaskID/Task List/Duration/Links are NOT merged — they vary per row.
    for (let col = 6; col <= 9; col++) {
      expect(sheet.getCell(3, col).isMerged).toBe(false);
    }
  });

  it("does not merge a single-task day (nothing to merge)", async () => {
    const workDay = makeWorkDay({
      tasks: [{ taskId: "T-1", description: "Solo", durationSeconds: 3600, link: null }],
    });
    const { sheet } = await buildAndReload([workDay]);
    expect(sheet.getCell(2, 1).isMerged).toBe(false);
  });
});

describe("buildWorkLogWorkbook — formatting", () => {
  it("formats duration as H:MM:SS with no leading zero on hours", async () => {
    const workDay = makeWorkDay({
      tasks: [{ taskId: "T-1", description: "A", durationSeconds: 4 * 3600, link: null }],
    });
    const { sheet } = await buildAndReload([workDay]);
    expect(sheet.getRow(2).getCell(8).value).toBe("4:00:00");
  });

  it("formats break the same way", async () => {
    const workDay = makeWorkDay({
      breakSeconds: 30 * 60,
      tasks: [{ taskId: "T-1", description: "A", durationSeconds: 3600, link: null }],
    });
    const { sheet } = await buildAndReload([workDay]);
    expect(sheet.getRow(2).getCell(5).value).toBe("0:30:00");
  });

  it("formats the date as MM/DD/YYYY", async () => {
    const { sheet } = await buildAndReload([makeWorkDay()]);
    expect(sheet.getRow(2).getCell(1).value).toBe("08/24/2026");
  });

  it("formats check-in/check-out as h:mm AM/PM", async () => {
    const { sheet } = await buildAndReload([makeWorkDay()]);
    expect(sheet.getRow(2).getCell(3).value).toBe("10:10 AM");
    expect(sheet.getRow(2).getCell(4).value).toBe("7:25 PM");
  });

  it("wraps text in the Task List column", async () => {
    const workDay = makeWorkDay({
      tasks: [{ taskId: "T-1", description: "A long description", durationSeconds: 3600, link: null }],
    });
    const { sheet } = await buildAndReload([workDay]);
    expect(sheet.getRow(2).getCell(7).alignment?.wrapText).toBe(true);
  });

  it("every data cell has a border", async () => {
    const workDay = makeWorkDay({
      tasks: [{ taskId: "T-1", description: "A", durationSeconds: 3600, link: null }],
    });
    const { sheet } = await buildAndReload([workDay]);
    for (let col = 1; col <= 9; col++) {
      expect(sheet.getRow(2).getCell(col).border?.top?.style).toBe("thin");
    }
  });
});

describe("buildWorkLogWorkbook — a totals row", () => {
  it("appends a bold TOTAL row summing every task's duration", async () => {
    const { sheet } = await buildAndReload([
      makeWorkDay({
        date: new Date(Date.UTC(2026, 7, 24)),
        tasks: [{ taskId: "T-1", description: "A", durationSeconds: 3 * 3600, link: null }],
      }),
      makeWorkDay({
        date: new Date(Date.UTC(2026, 7, 25)),
        tasks: [{ taskId: "T-2", description: "B", durationSeconds: 90 * 60, link: null }],
      }),
    ]);

    const totals = sheet.getRow(sheet.rowCount);
    expect(totals.getCell(6).value).toBe("TOTAL");
    expect(totals.getCell(8).value).toBe("4:30:00");
    expect(totals.getCell(8).font?.bold).toBe(true);
  });
});

describe("buildWorkLogWorkbook — hyperlinks", () => {
  it("writes a real hyperlink whose display text is 'link' and target is the URL", async () => {
    const workDay = makeWorkDay({
      tasks: [
        {
          taskId: "T-1",
          description: "A",
          durationSeconds: 3600,
          link: "https://example.com/T-1",
        },
      ],
    });
    const { sheet } = await buildAndReload([workDay]);
    const cell = sheet.getRow(2).getCell(9);
    expect(cell.value).toMatchObject({
      hyperlink: "https://example.com/T-1",
      text: "link",
    });
  });

  it("leaves the Links cell blank when there is no link", async () => {
    const workDay = makeWorkDay({
      tasks: [{ taskId: "T-1", description: "A", durationSeconds: 3600, link: null }],
    });
    const { sheet } = await buildAndReload([workDay]);
    expect(sheet.getRow(2).getCell(9).value).toBeFalsy();
  });
});

describe("buildWorkLogWorkbook — holiday / leave / weekly-off rows", () => {
  it("writes a holiday as Date + Day + a merged bold HOLIDAY cell across C..I", async () => {
    const workDay = makeWorkDay({
      checkIn: null,
      checkOut: null,
      breakSeconds: 0,
      dayType: "HOLIDAY",
      dayNote: "Independence Day",
    });
    const { sheet } = await buildAndReload([workDay]);

    expect(sheet.rowCount).toBe(3); // header + 1 holiday row + totals
    expect(sheet.getRow(2).getCell(1).value).toBe("08/24/2026");
    expect(sheet.getRow(2).getCell(2).value).toBe("Monday");
    expect(sheet.getRow(2).getCell(3).value).toBe("HOLIDAY (Independence Day)");
    expect(sheet.getRow(2).getCell(3).font?.bold).toBe(true);
    // C..I merged into the label cell
    for (let col = 4; col <= 9; col++) {
      expect(sheet.getCell(2, col).isMerged).toBe(true);
      expect(sheet.getCell(2, col).master.address).toBe(sheet.getCell(2, 3).address);
    }
  });

  it("holiday without a reason just says HOLIDAY", async () => {
    const workDay = makeWorkDay({ dayType: "HOLIDAY", dayNote: null, checkIn: null, checkOut: null });
    const { sheet } = await buildAndReload([workDay]);
    expect(sheet.getRow(2).getCell(3).value).toBe("HOLIDAY");
  });

  it("writes a leave day with a merged bold LEAVE cell", async () => {
    const workDay = makeWorkDay({
      dayType: "LEAVE",
      dayNote: "Sick",
      checkIn: null,
      checkOut: null,
    });
    const { sheet } = await buildAndReload([workDay]);
    expect(sheet.getRow(2).getCell(3).value).toBe("LEAVE (Sick)");
    expect(sheet.getRow(2).getCell(3).font?.bold).toBe(true);
  });

  it("writes a blank non-working day (weekend) as a merged bold WEEKLY OFF cell", async () => {
    // 2026-08-29 is a Saturday — not in MON_FRI, nothing logged.
    const saturday = makeWorkDay({
      date: new Date(Date.UTC(2026, 7, 29)),
      checkIn: null,
      checkOut: null,
      breakSeconds: 0,
      tasks: [],
    });
    const { sheet } = await buildAndReload([saturday]);
    expect(sheet.getRow(2).getCell(3).value).toBe("WEEKLY OFF");
    expect(sheet.getRow(2).getCell(3).font?.bold).toBe(true);
  });

  it("a weekend day with work logged renders as a normal work row, not WEEKLY OFF", async () => {
    const workedSaturday = makeWorkDay({
      date: new Date(Date.UTC(2026, 7, 29)),
      tasks: [{ taskId: "T-1", description: "Weekend work", durationSeconds: 3600, link: null }],
    });
    const { sheet } = await buildAndReload([workedSaturday]);
    expect(sheet.getRow(2).getCell(6).value).toBe("T-1");
  });

  it("respects a custom working-days set — a Friday can be the weekly off", async () => {
    const friday = makeWorkDay({
      date: new Date(Date.UTC(2026, 7, 28)), // Friday
      checkIn: null,
      checkOut: null,
      breakSeconds: 0,
      tasks: [],
    });
    const { sheet } = await buildAndReload([friday], [0, 1, 2, 3, 4]); // Sun-Thu
    expect(sheet.getRow(2).getCell(3).value).toBe("WEEKLY OFF");
  });
});

describe("buildWorkLogWorkbook — empty task days", () => {
  it("writes a single row with blank task columns when a working day has no tasks", async () => {
    const { sheet } = await buildAndReload([makeWorkDay({ tasks: [] })]);
    expect(sheet.rowCount).toBe(3); // header + 1 day + totals
    expect(sheet.getRow(2).getCell(6).value).toBeFalsy();
    expect(sheet.getRow(2).getCell(7).value).toBeFalsy();
    // A working day with a check-in still shows the time, not WEEKLY OFF.
    expect(sheet.getRow(2).getCell(3).value).toBe("10:10 AM");
  });
});

describe("buildWorkLogWorkbook — multi-day (date-range) export", () => {
  it("includes every day, sorted ascending by date regardless of input order", async () => {
    const dayA = makeWorkDay({
      date: new Date(Date.UTC(2026, 7, 25)),
      tasks: [{ taskId: "T-2", description: "Later", durationSeconds: 3600, link: null }],
    });
    const dayB = makeWorkDay({
      date: new Date(Date.UTC(2026, 7, 24)),
      tasks: [{ taskId: "T-1", description: "Earlier", durationSeconds: 3600, link: null }],
    });

    const { sheet } = await buildAndReload([dayA, dayB]); // deliberately out of order

    expect(sheet.getRow(2).getCell(1).value).toBe("08/24/2026");
    expect(sheet.getRow(3).getCell(1).value).toBe("08/25/2026");
  });

  it("a mix of a normal day, a holiday, and an empty day all render correctly together", async () => {
    const normal = makeWorkDay({
      date: new Date(Date.UTC(2026, 7, 24)),
      tasks: [{ taskId: "T-1", description: "Work", durationSeconds: 3600, link: null }],
    });
    const holiday = makeWorkDay({
      date: new Date(Date.UTC(2026, 7, 25)),
      dayType: "HOLIDAY",
      dayNote: "Company holiday",
      checkIn: null,
      checkOut: null,
    });
    const empty = makeWorkDay({ date: new Date(Date.UTC(2026, 7, 26)), tasks: [] });

    const { sheet } = await buildAndReload([normal, holiday, empty]);

    expect(sheet.rowCount).toBe(5); // header + 3 days + totals
    expect(sheet.getRow(3).getCell(3).value).toBe("HOLIDAY (Company holiday)");
    expect(lastDataRow(sheet)).toBe(4);
  });
});

describe("buildWorkLogWorkbook — special characters", () => {
  it("round-trips quotes, ampersands, and unicode in the task description", async () => {
    const description = `Fixed "quoted" bug & added emoji support 🎉 — see <script>`;
    const workDay = makeWorkDay({
      tasks: [{ taskId: "T-1", description, durationSeconds: 3600, link: null }],
    });
    const { sheet } = await buildAndReload([workDay]);
    expect(sheet.getRow(2).getCell(7).value).toBe(description);
  });

  it("round-trips a newline in the task description", async () => {
    const description = "Line one\nLine two";
    const workDay = makeWorkDay({
      tasks: [{ taskId: "T-1", description, durationSeconds: 3600, link: null }],
    });
    const { sheet } = await buildAndReload([workDay]);
    expect(sheet.getRow(2).getCell(7).value).toBe(description);
  });
});

describe("buildWorkLogWorkbook — the file itself opens", () => {
  it("produces a non-empty buffer that a fresh ExcelJS instance can load without throwing", async () => {
    const { buffer } = await buildAndReload([makeWorkDay({ tasks: [] })]);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
