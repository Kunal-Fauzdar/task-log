// Google spreadsheet ids are URL-safe base64-ish: letters, digits, "-" and "_", ~44 chars.
const SPREADSHEET_ID_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
const SPREADSHEET_URL_PATTERN = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/;

// Accepts a full sheet link (https://docs.google.com/spreadsheets/d/<id>/edit#gid=0) or a bare
// id. Returns null for anything that isn't recognisably a Google Sheet.
export function extractSpreadsheetId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const fromUrl = SPREADSHEET_URL_PATTERN.exec(value)?.[1];
  const candidate = fromUrl ?? value;
  return SPREADSHEET_ID_PATTERN.test(candidate) ? candidate : null;
}

export function spreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// One tab per month, named by the month alone ("November") — the user's own timesheet
// convention. The year is deliberately ignored (user decision): the same tab is reused every
// year, so next November's sync rewrites it.
export function monthTabName(month: Date): string {
  return MONTH_NAMES[month.getUTCMonth()];
}

// The existing tab for `month`, matched by name case-insensitively ("november", " November ").
// Null → the caller creates a new tab named monthTabName(month).
export function findMonthTab(titles: string[], month: Date): string | null {
  const target = monthTabName(month).toLowerCase();
  return titles.find((title) => title.trim().toLowerCase() === target) ?? null;
}
