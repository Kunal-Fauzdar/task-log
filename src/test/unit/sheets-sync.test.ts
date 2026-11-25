import { describe, expect, it } from "vitest";

import { extractSpreadsheetId, findMonthTab, monthTabName } from "@/lib/domain/sheets";
import { buildWorkLogWorkbook, EXCEL_HEADERS, type ExportWorkDay } from "@/lib/excel/export";
import { buildSyncRequests, parseA1Range, worksheetToSheetLayout } from "@/lib/sheets/layout";

const SHEET_ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";

describe("extractSpreadsheetId", () => {
  it("pulls the id out of a full sheet link", () => {
    expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`)).toBe(SHEET_ID);
    expect(extractSpreadsheetId(`  https://docs.google.com/spreadsheets/d/${SHEET_ID}  `)).toBe(SHEET_ID);
  });

  it("accepts a bare id", () => {
    expect(extractSpreadsheetId(SHEET_ID)).toBe(SHEET_ID);
  });

  it("rejects anything that isn't a sheet", () => {
    expect(extractSpreadsheetId("")).toBeNull();
    expect(extractSpreadsheetId("https://example.com/foo")).toBeNull();
    expect(extractSpreadsheetId("https://docs.google.com/document/d/abc/edit")).toBeNull();
  });
});

const NOV_2026 = new Date(Date.UTC(2026, 10, 1));
const MONTH_ONLY_TABS = ["January", "February", "October", "November", "December"];

describe("monthTabName", () => {
  it("is the month name alone, no year", () => {
    expect(monthTabName(NOV_2026)).toBe("November");
    expect(monthTabName(new Date(Date.UTC(2027, 0, 1)))).toBe("January");
  });
});

describe("findMonthTab", () => {
  it("finds the existing month tab, ignoring case and surrounding spaces", () => {
    expect(findMonthTab(MONTH_ONLY_TABS, NOV_2026)).toBe("November");
    expect(findMonthTab(["october", " november "], NOV_2026)).toBe(" november ");
  });

  it("returns null when the month has no tab (caller creates one)", () => {
    expect(findMonthTab(["January", "Sheet1", "November 2026"], NOV_2026)).toBeNull();
  });
});

describe("parseA1Range", () => {
  it("converts to zero-based, end-exclusive indices", () => {
    expect(parseA1Range("A2:A4")).toEqual({ startRowIndex: 1, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 1 });
    expect(parseA1Range("C5:I5")).toEqual({ startRowIndex: 4, endRowIndex: 5, startColumnIndex: 2, endColumnIndex: 9 });
  });
});

function makeWorkDay(overrides: Partial<ExportWorkDay> = {}): ExportWorkDay {
  return {
    date: new Date(Date.UTC(2026, 7, 24)), // Monday
    checkIn: new Date(Date.UTC(2026, 7, 24, 10, 10)),
    checkOut: new Date(Date.UTC(2026, 7, 24, 19, 25)),
    breakSeconds: 1800,
    dayType: "WORKING",
    dayNote: null,
    tasks: [],
    ...overrides,
  };
}

async function layoutFor(workDays: ExportWorkDay[]) {
  const workbook = await buildWorkLogWorkbook(workDays, [1, 2, 3, 4, 5]);
  return worksheetToSheetLayout(workbook.worksheets[0]);
}

function text(cell: { userEnteredValue?: object }) {
  const value = cell.userEnteredValue as { stringValue?: string; formulaValue?: string } | undefined;
  return value?.stringValue ?? value?.formulaValue;
}

describe("worksheetToSheetLayout — mirrors the Excel export", () => {
  it("writes the exact header row, bold and filled", async () => {
    const layout = await layoutFor([]);
    expect(layout.rows[0].map(text)).toEqual([...EXCEL_HEADERS]);
    expect(layout.rows[0][0].userEnteredFormat).toMatchObject({ textFormat: { bold: true }, backgroundColor: expect.any(Object) });
    expect(layout.columnCount).toBe(9);
  });

  it("merges a multi-task day's date columns and blanks the non-master cells", async () => {
    const layout = await layoutFor([
      makeWorkDay({
        tasks: [
          { taskId: "T-1", description: "One", durationSeconds: 3600, link: "https://example.com/a?q=\"x\"" },
          { taskId: "T-2", description: "=not a formula", durationSeconds: 1800, link: null },
        ],
      }),
    ]);
    // header + 2 task rows + TOTAL
    expect(layout.rows).toHaveLength(4);
    expect(text(layout.rows[1][0])).toBe("08/24/2026");
    expect(text(layout.rows[2][0])).toBeUndefined();
    expect(layout.merges).toContainEqual({ startRowIndex: 1, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 });

    // Hyperlink → HYPERLINK formula with "link" text and escaped quotes.
    expect(text(layout.rows[1][8])).toBe('=HYPERLINK("https://example.com/a?q=""x""","link")');
    // A description starting with "=" stays literal text.
    expect(layout.rows[2][6].userEnteredValue).toEqual({ stringValue: "=not a formula" });
    expect(text(layout.rows[3][5])).toBe("TOTAL");
    expect(text(layout.rows[3][7])).toBe("1:30:00");
  });

  it("merges a holiday row's label across C..I", async () => {
    const layout = await layoutFor([makeWorkDay({ dayType: "HOLIDAY", dayNote: "Diwali", checkIn: null, checkOut: null })]);
    expect(text(layout.rows[1][2])).toBe("HOLIDAY (Diwali)");
    expect(layout.merges).toContainEqual({ startRowIndex: 1, endRowIndex: 2, startColumnIndex: 2, endColumnIndex: 9 });
  });
});

describe("buildSyncRequests", () => {
  it("grows but never shrinks the grid, and rewrites the whole tab", async () => {
    const layout = await layoutFor([]);
    type Req = {
      updateSheetProperties: { properties: { gridProperties: unknown } };
      updateCells: { rows?: unknown[] };
    };
    const requests = buildSyncRequests(7, layout, { rowCount: 1000, columnCount: 5 }) as Req[];
    expect(requests[0].updateSheetProperties.properties.gridProperties).toEqual({
      rowCount: 1000,
      columnCount: 9,
      frozenRowCount: 1,
    });
    expect(requests[1]).toHaveProperty("unmergeCells");
    expect(requests[2].updateCells.rows).toBeUndefined(); // the clear
    expect(requests[3].updateCells.rows).toHaveLength(layout.rows.length);
    expect(requests.every((r) => JSON.stringify(r).includes('"sheetId":7'))).toBe(true);
  });
});
