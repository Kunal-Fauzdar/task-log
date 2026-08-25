import ExcelJS from "exceljs";

import { EXCEL_HEADERS } from "@/lib/excel/export";
import { isValidTaskId } from "@/lib/domain/task";
import { parseDurationToSeconds } from "@/lib/domain/duration";
import { formatDateOnly, getDayName, parseClockTimeToHHMM, parseDateUS } from "@/lib/domain/date";

export type ImportTaskRow = {
  rowNumber: number;
  taskId: string;
  description: string;
  durationSeconds: number;
  link: string | null;
};

export type ImportGroup = {
  date: string; // "YYYY-MM-DD"
  day: string;
  isHoliday: boolean;
  holidayReason: string | null;
  checkIn: string | null; // "HH:MM"
  checkOut: string | null; // "HH:MM"
  breakSeconds: number;
  tasks: ImportTaskRow[];
  // Validation problems found while parsing this group's rows — does not prevent grouping, but
  // a group with any errors should not be importable until the source file is fixed (spec §30:
  // "report invalid rows").
  errors: string[];
};

export type ImportRowError = { rowNumber: number; message: string };

export type ImportPreview =
  | { valid: false; headerError: string }
  | { valid: true; groups: ImportGroup[]; rowErrors: ImportRowError[] };

function isRowEmpty(row: ExcelJS.Row): boolean {
  for (let col = 1; col <= 9; col++) {
    const value = row.getCell(col).value;
    if (value !== null && value !== undefined && String(value).trim() !== "") return false;
  }
  return true;
}

function extractDate(cell: ExcelJS.Cell): Date {
  const value = cell.value;
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === "string" && value.trim() !== "") {
    return parseDateUS(value);
  }
  throw new RangeError("Missing or unrecognized Date value");
}

function extractClockTimeHHMM(cell: ExcelJS.Cell): string | null {
  const value = cell.value;
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    const hours = String(value.getUTCHours()).padStart(2, "0");
    const minutes = String(value.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  if (typeof value === "string") {
    return parseClockTimeToHHMM(value);
  }
  throw new RangeError("Unrecognized Check In/Out value");
}

function extractDurationSeconds(cell: ExcelJS.Cell): number {
  const value = cell.value;
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") return parseDurationToSeconds(value);
  throw new RangeError("Unrecognized duration value");
}

function extractLink(cell: ExcelJS.Cell): string | null {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && "hyperlink" in value && typeof value.hyperlink === "string") {
    return value.hyperlink;
  }
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

function timeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

const HOLIDAY_PATTERN = /^HOLIDAY(?:\s*\((.+)\))?$/i;

// Parses a previously-exported WorkLog .xlsx back into candidate WorkDay/Task groups (spec
// §30/§41: parse, validate headers, detect dates, detect multiple tasks per day, preserve
// links, report invalid rows). Pure parsing only — no DB access, no duplicate detection (the
// caller does that, since it needs to know which dates already exist).
//
// Rows for the same WorkDay are assumed to be contiguous, matching how buildWorkLogWorkbook
// (src/lib/excel/export.ts) always writes them — one visual block per day.
export async function parseWorkLogWorkbook(buffer: Buffer): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { valid: false, headerError: "The uploaded file has no worksheets." };
  }

  const headerRow = sheet.getRow(1);
  const headersMatch = EXCEL_HEADERS.every(
    (expected, index) => String(headerRow.getCell(index + 1).value ?? "").trim() === expected,
  );
  if (!headersMatch) {
    return {
      valid: false,
      headerError: `This doesn't look like a WorkLog export. Expected columns: ${EXCEL_HEADERS.join(", ")}.`,
    };
  }

  const groups: ImportGroup[] = [];
  const rowErrors: ImportRowError[] = [];
  let currentGroup: ImportGroup | null = null;

  function flushCurrentGroup() {
    if (currentGroup) groups.push(currentGroup);
    currentGroup = null;
  }

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (isRowEmpty(row)) continue;

    const taskIdRaw = String(row.getCell(6).value ?? "").trim();
    const taskListRaw = String(row.getCell(7).value ?? "").trim();
    const isHolidayRow = taskIdRaw === "" && HOLIDAY_PATTERN.test(taskListRaw);

    let date: Date;
    try {
      date = extractDate(row.getCell(1));
    } catch (error) {
      rowErrors.push({ rowNumber, message: (error as Error).message });
      continue;
    }
    const isoDate = formatDateOnly(date);

    if (isHolidayRow) {
      flushCurrentGroup();
      const reasonMatch = HOLIDAY_PATTERN.exec(taskListRaw);
      groups.push({
        date: isoDate,
        day: getDayName(date),
        isHoliday: true,
        holidayReason: reasonMatch?.[1]?.trim() || null,
        checkIn: null,
        checkOut: null,
        breakSeconds: 0,
        tasks: [],
        errors: [],
      });
      continue;
    }

    const issues: string[] = [];
    let checkIn: string | null = null;
    let checkOut: string | null = null;
    let breakSeconds = 0;

    try {
      checkIn = extractClockTimeHHMM(row.getCell(3));
    } catch (error) {
      issues.push(`Row ${rowNumber}: ${(error as Error).message}`);
    }
    try {
      checkOut = extractClockTimeHHMM(row.getCell(4));
    } catch (error) {
      issues.push(`Row ${rowNumber}: ${(error as Error).message}`);
    }
    try {
      breakSeconds = extractDurationSeconds(row.getCell(5));
    } catch (error) {
      issues.push(`Row ${rowNumber}: ${(error as Error).message}`);
    }
    if (checkIn && checkOut && timeToMinutes(checkOut) <= timeToMinutes(checkIn)) {
      issues.push(`Row ${rowNumber}: Check Out must be after Check In`);
    }

    if (!currentGroup || currentGroup.date !== isoDate) {
      flushCurrentGroup();
      currentGroup = {
        date: isoDate,
        day: getDayName(date),
        isHoliday: false,
        holidayReason: null,
        checkIn,
        checkOut,
        breakSeconds,
        tasks: [],
        errors: [],
      };
    }
    currentGroup.errors.push(...issues);

    if (taskIdRaw !== "") {
      let durationSeconds = 0;
      try {
        durationSeconds = extractDurationSeconds(row.getCell(8));
      } catch (error) {
        currentGroup.errors.push(`Row ${rowNumber}: ${(error as Error).message}`);
      }
      if (!isValidTaskId(taskIdRaw)) {
        currentGroup.errors.push(`Row ${rowNumber}: Invalid Task ID "${taskIdRaw}"`);
      }
      if (taskListRaw === "") {
        currentGroup.errors.push(`Row ${rowNumber}: Task description is required`);
      }
      const link = extractLink(row.getCell(9));
      if (link && !/^https?:\/\//i.test(link)) {
        currentGroup.errors.push(`Row ${rowNumber}: Link must start with http:// or https://`);
      }
      currentGroup.tasks.push({ rowNumber, taskId: taskIdRaw, description: taskListRaw, durationSeconds, link });
    }
  }
  flushCurrentGroup();

  return { valid: true, groups, rowErrors };
}
