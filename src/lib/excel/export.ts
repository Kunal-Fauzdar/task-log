import ExcelJS from "exceljs";

import { formatClockTime, formatDateUS, getDayName } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { isWorkingDay } from "@/lib/domain/settings";

// Exact header row, exact order — required by spec §6/§25, never reorder or rename these.
export const EXCEL_HEADERS = [
  "Date",
  "Day",
  "Check In",
  "Check Out",
  "Break",
  "TaskID",
  "Task List",
  "Duration of Task",
  "Links",
] as const;

const COLUMN_WIDTHS = [13, 11, 11, 11, 10, 12, 55, 16, 14];

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const HYPERLINK_FONT = { color: { argb: "FF0563C1" }, underline: true };

// The single word shown (and hyperlinked) in the Links column when a task has a link — the URL
// itself is the target, not the display text (per explicit user request).
const LINK_CELL_TEXT = "link";

// Labels for a whole-day row that isn't a normal work day. Distinct on purpose (user request):
// a weekend reads differently from a declared public holiday and from personal leave.
const DAY_OFF_LABEL = {
  HOLIDAY: "HOLIDAY",
  LEAVE: "LEAVE",
  WEEKLY_OFF: "WEEKLY OFF",
} as const;

export type ExportTask = {
  taskId: string;
  description: string;
  durationSeconds: number;
  link: string | null;
};

export type ExportWorkDay = {
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  breakSeconds: number;
  dayType: "WORKING" | "HOLIDAY" | "LEAVE";
  dayNote: string | null;
  tasks: ExportTask[];
};

function borderCells(sheet: ExcelJS.Worksheet, row: number, fromCol: number, toCol: number) {
  for (let col = fromCol; col <= toCol; col++) {
    sheet.getCell(row, col).border = THIN_BORDER;
  }
}

function applyBordersToRow(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = THIN_BORDER;
  });
}

// Vertically-merged Date/Day/Check In/Check Out/Break columns (spec §26) read best centered
// within their merged block, whether or not the day actually has more than one task row.
function centerDateColumns(sheet: ExcelJS.Worksheet, row: number) {
  for (let col = 1; col <= 5; col++) {
    sheet.getCell(row, col).alignment = { vertical: "middle", horizontal: "center" };
  }
}

// One row for a day with no work: Date + Day filled normally, columns C..I merged into a single
// bold, centered label cell ("HOLIDAY" / "LEAVE" / "WEEKLY OFF", plus "(reason)" when set).
function addDayOffRow(
  sheet: ExcelJS.Worksheet,
  workDay: ExportWorkDay,
  label: string,
) {
  const startRow = sheet.rowCount + 1;
  const text = workDay.dayNote ? `${label} (${workDay.dayNote})` : label;
  const row = sheet.addRow([formatDateUS(workDay.date), getDayName(workDay.date), text]);
  borderCells(sheet, startRow, 1, 9);
  sheet.mergeCells(startRow, 3, startRow, 9);
  centerDateColumns(sheet, startRow);
  row.getCell(3).font = { bold: true };
  row.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
}

export async function buildWorkLogWorkbook(
  workDays: ExportWorkDay[],
  workingDays: number[],
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WorkLog Manager";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Work Log");
  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }));
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const headerRow = sheet.addRow([...EXCEL_HEADERS]);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    cell.border = THIN_BORDER;
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };

  const sorted = [...workDays].sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalTaskSeconds = 0;

  for (const workDay of sorted) {
    const startRow = sheet.rowCount + 1;
    const hasWork = Boolean(workDay.checkIn) || workDay.tasks.length > 0;

    if (workDay.dayType === "HOLIDAY") {
      addDayOffRow(sheet, workDay, DAY_OFF_LABEL.HOLIDAY);
      continue;
    }
    if (workDay.dayType === "LEAVE") {
      addDayOffRow(sheet, workDay, DAY_OFF_LABEL.LEAVE);
      continue;
    }
    // A plain (non-holiday, non-leave) day with nothing logged that falls outside the user's
    // configured working days renders as a weekend "WEEKLY OFF" row rather than a blank work row.
    if (!hasWork && !isWorkingDay(workDay.date.getUTCDay(), workingDays)) {
      addDayOffRow(sheet, workDay, DAY_OFF_LABEL.WEEKLY_OFF);
      continue;
    }

    const dateCells = [
      formatDateUS(workDay.date),
      getDayName(workDay.date),
      workDay.checkIn ? formatClockTime(workDay.checkIn) : "",
      workDay.checkOut ? formatClockTime(workDay.checkOut) : "",
      formatSecondsToDuration(workDay.breakSeconds),
    ];

    if (workDay.tasks.length === 0) {
      const row = sheet.addRow([...dateCells, "", "", "", ""]);
      applyBordersToRow(row);
      centerDateColumns(sheet, startRow);
      continue;
    }

    for (const task of workDay.tasks) {
      totalTaskSeconds += task.durationSeconds;
      const row = sheet.addRow([
        ...dateCells,
        task.taskId,
        task.description,
        formatSecondsToDuration(task.durationSeconds),
        task.link ? { text: LINK_CELL_TEXT, hyperlink: task.link } : "",
      ]);
      applyBordersToRow(row);
      row.getCell(7).alignment = { wrapText: true, vertical: "top" };
      row.getCell(8).alignment = { horizontal: "right" };
      if (task.link) {
        row.getCell(9).font = HYPERLINK_FONT;
        row.getCell(9).alignment = { horizontal: "center" };
      }
    }

    const endRow = sheet.rowCount;
    if (endRow > startRow) {
      for (let col = 1; col <= 5; col++) {
        sheet.mergeCells(startRow, col, endRow, col);
      }
    }
    centerDateColumns(sheet, startRow);
  }

  // Totals row — sum of every task's duration across the export, formatted the same H:MM:SS way
  // as the per-task cells (durations are written as text, not Excel time values, so this is
  // computed here rather than left to a spreadsheet SUM).
  const totalsRow = sheet.addRow(["", "", "", "", "", "TOTAL", "", formatSecondsToDuration(totalTaskSeconds), ""]);
  totalsRow.font = { bold: true };
  totalsRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { ...THIN_BORDER, top: { style: "medium" } };
  });
  totalsRow.getCell(6).alignment = { horizontal: "right" };
  totalsRow.getCell(8).alignment = { horizontal: "right" };

  return workbook;
}
