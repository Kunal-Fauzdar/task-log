import ExcelJS from "exceljs";

import { formatClockTime, formatDateUS, getDayName } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";

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

const COLUMN_WIDTHS = [12, 11, 11, 11, 10, 12, 55, 16, 35];

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const HYPERLINK_FONT = { color: { argb: "FF0563C1" }, underline: true };

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
  isHoliday: boolean;
  holidayReason: string | null;
  tasks: ExportTask[];
};

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

export async function buildWorkLogWorkbook(workDays: ExportWorkDay[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WorkLog Manager";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Work Log");
  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }));
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const headerRow = sheet.addRow([...EXCEL_HEADERS]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    cell.border = THIN_BORDER;
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const sorted = [...workDays].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const workDay of sorted) {
    const startRow = sheet.rowCount + 1;

    // Holiday row layout is an assumption, not a confirmed spec — no submission screenshot was
    // ever provided (see CLAUDE.md §3). Confirm against the real format before treating this
    // as done.
    if (workDay.isHoliday) {
      const row = sheet.addRow([
        formatDateUS(workDay.date),
        getDayName(workDay.date),
        "",
        "",
        "",
        "",
        workDay.holidayReason ? `HOLIDAY (${workDay.holidayReason})` : "HOLIDAY",
        "",
        "",
      ]);
      applyBordersToRow(row);
      centerDateColumns(sheet, startRow);
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
      const row = sheet.addRow([
        ...dateCells,
        task.taskId,
        task.description,
        formatSecondsToDuration(task.durationSeconds),
        task.link ? { text: task.link, hyperlink: task.link } : "",
      ]);
      applyBordersToRow(row);
      row.getCell(7).alignment = { wrapText: true, vertical: "top" };
      if (task.link) {
        row.getCell(9).font = HYPERLINK_FONT;
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

  return workbook;
}
