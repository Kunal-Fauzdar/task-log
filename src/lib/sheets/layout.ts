import type ExcelJS from "exceljs";

// Translates the worksheet built by buildWorkLogWorkbook (src/lib/excel/export.ts) into Google
// Sheets API batchUpdate requests. Deliberately reads the finished ExcelJS sheet rather than
// re-deriving the layout, so the synced Google tab and the downloaded .xlsx can never drift:
// one layout implementation, two renderers.

type GridRange = {
  sheetId: number;
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
};

type SheetsCell = {
  userEnteredValue?: { stringValue: string } | { formulaValue: string };
  userEnteredFormat?: Record<string, unknown>;
};

export type SheetLayout = {
  rows: SheetsCell[][];
  merges: Omit<GridRange, "sheetId">[];
  columnWidthsPx: number[];
  columnCount: number;
};

const HEADER_FILL = { red: 0.85, green: 0.85, blue: 0.85 };
const LINK_COLOR = { red: 0.02, green: 0.39, blue: 0.76 };
const SOLID = { style: "SOLID" };
const BORDERS = { top: SOLID, bottom: SOLID, left: SOLID, right: SOLID };

// Excel column width is in "characters"; ~7px per character is the usual conversion.
const PX_PER_EXCEL_WIDTH_UNIT = 7;

function columnLettersToIndex(letters: string): number {
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

// "A2:E4" → zero-based, end-exclusive grid range.
export function parseA1Range(range: string): Omit<GridRange, "sheetId"> {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
  if (!match) throw new RangeError(`Unexpected merge range "${range}"`);
  const [, c1, r1, c2, r2] = match;
  return {
    startRowIndex: Number(r1) - 1,
    endRowIndex: Number(r2),
    startColumnIndex: columnLettersToIndex(c1),
    endColumnIndex: columnLettersToIndex(c2) + 1,
  };
}

// Sheets formula string literal: double any embedded quote.
function quoteFormulaString(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toHorizontal(value: string | undefined): string | undefined {
  if (value === "center") return "CENTER";
  if (value === "right") return "RIGHT";
  if (value === "left") return "LEFT";
  return undefined;
}

function toVertical(value: string | undefined): string | undefined {
  if (value === "middle") return "MIDDLE";
  if (value === "top") return "TOP";
  if (value === "bottom") return "BOTTOM";
  return undefined;
}

function convertCell(cell: ExcelJS.Cell, isHeader: boolean): SheetsCell {
  const format: Record<string, unknown> = { borders: BORDERS };
  const textFormat: Record<string, unknown> = {};
  if (cell.font?.bold) textFormat.bold = true;
  if (isHeader) format.backgroundColor = HEADER_FILL;

  const horizontal = toHorizontal(cell.alignment?.horizontal);
  const vertical = toVertical(cell.alignment?.vertical);
  if (horizontal) format.horizontalAlignment = horizontal;
  if (vertical) format.verticalAlignment = vertical;
  if (cell.alignment?.wrapText) format.wrapStrategy = "WRAP";

  // A merged block's non-master cells carry the master's value in ExcelJS — only the top-left
  // cell should hold it in Sheets.
  const isMergeSlave = cell.isMerged && cell.master.address !== cell.address;
  const value = isMergeSlave ? null : cell.value;

  let userEnteredValue: SheetsCell["userEnteredValue"];
  if (value && typeof value === "object" && "hyperlink" in value && value.hyperlink) {
    userEnteredValue = {
      formulaValue: `=HYPERLINK(${quoteFormulaString(value.hyperlink)},${quoteFormulaString(String(value.text ?? ""))})`,
    };
    textFormat.foregroundColor = LINK_COLOR;
    textFormat.underline = true;
  } else if (value !== null && value !== undefined && value !== "") {
    // Always a string value, never a parsed number/date/formula — matches the xlsx (which writes
    // formatted text, CLAUDE.md §3) and means a description starting with "=" stays literal text.
    userEnteredValue = { stringValue: String(value) };
  }

  if (Object.keys(textFormat).length > 0) format.textFormat = textFormat;
  return { ...(userEnteredValue ? { userEnteredValue } : {}), userEnteredFormat: format };
}

export function worksheetToSheetLayout(sheet: ExcelJS.Worksheet): SheetLayout {
  const columnCount = sheet.columnCount;
  const rows: SheetsCell[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells: SheetsCell[] = [];
    for (let c = 1; c <= columnCount; c++) {
      cells.push(convertCell(row.getCell(c), r === 1));
    }
    rows.push(cells);
  }

  const merges = (sheet.model.merges ?? []).map(parseA1Range);
  const columnWidthsPx = Array.from({ length: columnCount }, (_, i) =>
    Math.round((sheet.getColumn(i + 1).width ?? 10) * PX_PER_EXCEL_WIDTH_UNIT),
  );

  return { rows, merges, columnWidthsPx, columnCount };
}

// Full rewrite of one tab, as a single atomic batchUpdate: drop old merges + contents/formatting,
// make sure the grid is big enough, write every cell, re-merge, freeze the header, size columns.
// `existing` is the tab's current grid size — only ever grown, never shrunk (shrinking deletes
// rows, and a later month can legitimately be shorter).
export function buildSyncRequests(
  sheetId: number,
  layout: SheetLayout,
  existing: { rowCount: number; columnCount: number },
): object[] {
  const rowCount = Math.max(existing.rowCount, layout.rows.length + 1);
  const columnCount = Math.max(existing.columnCount, layout.columnCount);
  const wholeSheet = {
    sheetId,
    startRowIndex: 0,
    endRowIndex: rowCount,
    startColumnIndex: 0,
    endColumnIndex: columnCount,
  };

  return [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { rowCount, columnCount, frozenRowCount: 1 } },
        fields: "gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount",
      },
    },
    { unmergeCells: { range: wholeSheet } },
    { updateCells: { range: wholeSheet, fields: "userEnteredValue,userEnteredFormat" } },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        rows: layout.rows.map((values) => ({ values })),
        fields: "userEnteredValue,userEnteredFormat",
      },
    },
    ...layout.merges.map((range) => ({
      mergeCells: { range: { sheetId, ...range }, mergeType: "MERGE_ALL" },
    })),
    ...layout.columnWidthsPx.map((pixelSize, index) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
        properties: { pixelSize },
        fields: "pixelSize",
      },
    })),
  ];
}
