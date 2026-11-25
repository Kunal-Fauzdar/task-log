import { after } from "next/server";

import { loadExportData } from "@/lib/data/export-data";
import {
  clearGoogleConnection,
  getGoogleRefreshToken,
  getSheetSettings,
  recordSheetSyncResult,
} from "@/lib/data/settings";
import { findMonthTab, monthTabName } from "@/lib/domain/sheets";
import { getMonthRange } from "@/lib/domain/workday";
import { buildWorkLogWorkbook } from "@/lib/excel/export";
import {
  addTab,
  batchUpdate,
  isServiceAccountConfigured,
  listTabs,
  SheetsError,
  type SheetsAuth,
  type SheetTab,
} from "@/lib/sheets/google-client";
import { GoogleAuthError, isGoogleOAuthConfigured } from "@/lib/sheets/google-oauth";
import { buildSyncRequests, worksheetToSheetLayout } from "@/lib/sheets/layout";

// One-way mirror: the database is the source of truth, and each sync fully rewrites that month's
// "<Month>" tab (e.g. "November") from it (same rows as the month Excel export). Idempotent by construction —
// a missed or failed sync is repaired by the next one, or by "Sync now" on /settings.

export type SyncResult = { ok: true } | { ok: false; error: string };

async function writeMonthTab(
  auth: SheetsAuth,
  spreadsheetId: string,
  userId: string,
  month: Date,
): Promise<void> {
  const range = getMonthRange(month);
  const { workDays, workingDays } = await loadExportData(userId, range, null);
  const workbook = await buildWorkLogWorkbook(workDays, workingDays);
  const worksheet = workbook.worksheets[0];
  const layout = worksheetToSheetLayout(worksheet);

  const tab = await resolveMonthTab(auth, spreadsheetId, month);
  await batchUpdate(auth, spreadsheetId, buildSyncRequests(tab.sheetId, layout, tab));
}

// Write into the user's existing month tab ("November"); create it only if it doesn't exist.
async function resolveMonthTab(auth: SheetsAuth, spreadsheetId: string, month: Date): Promise<SheetTab> {
  const tabs = await listTabs(auth, spreadsheetId);
  const existing = findMonthTab(tabs.map((t) => t.title), month);
  return tabs.find((t) => t.title === existing) ?? (await addTab(auth, spreadsheetId, monthTabName(month)));
}

export function isSheetSyncAvailable(): boolean {
  return isGoogleOAuthConfigured() || isServiceAccountConfigured();
}

// The user's own Google account when connected (no sharing needed); otherwise the shared bot
// account if the server has one. Null = nothing to write with.
async function resolveAuth(userId: string): Promise<SheetsAuth | null> {
  const refreshToken = isGoogleOAuthConfigured() ? await getGoogleRefreshToken(userId) : null;
  if (refreshToken) return { kind: "user", userId, refreshToken };
  return isServiceAccountConfigured() ? { kind: "service" } : null;
}

// Syncs one month and records the outcome on AppSettings. Never throws — a Sheets outage must
// not surface as a failed task save.
export async function syncMonthToSheet(userId: string, month: Date): Promise<SyncResult> {
  if (!isSheetSyncAvailable()) {
    return { ok: false, error: "Google Sheets sync is not configured on the server." };
  }
  const { googleSheetId } = await getSheetSettings(userId);
  if (!googleSheetId) return { ok: false, error: "No Google Sheet is linked." };
  const auth = await resolveAuth(userId);
  if (!auth) return { ok: false, error: "Connect your Google account to sync your sheet." };

  try {
    await writeMonthTab(auth, googleSheetId, userId, month);
    await recordSheetSyncResult(userId, null);
    return { ok: true };
  } catch (error) {
    // A revoked/expired refresh token is permanent — drop it so Settings shows "Connect" again.
    if (error instanceof GoogleAuthError && error.revoked) {
      await clearGoogleConnection(userId).catch(() => {});
    }
    const message =
      error instanceof SheetsError || error instanceof GoogleAuthError
        ? error.message
        : "Couldn't update the Google Sheet. Try “Sync now”.";
    console.error("[sheets-sync]", error);
    await recordSheetSyncResult(userId, message).catch(() => {});
    return { ok: false, error: message };
  }
}

// Serialise syncs per user+month within this server instance. Each sync re-reads the DB when it
// starts, so running them in order guarantees the last one to finish wrote the latest state
// (rapid clicks would otherwise race and an older snapshot could land last).
const queues = new Map<string, Promise<unknown>>();

function enqueue(key: string, job: () => Promise<unknown>): Promise<unknown> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(job, job);
  queues.set(key, next);
  void next.finally(() => {
    if (queues.get(key) === next) queues.delete(key);
  });
  return next;
}

// Called from every work-day/task mutation (via revalidateWorkViews). Runs after the response is
// sent (`after`), so syncing never slows the UI down.
export function scheduleSheetSync(userId: string, dates: Date[]): void {
  if (!isSheetSyncAvailable() || dates.length === 0) return;
  const months = new Map<string, Date>();
  for (const date of dates) {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    months.set(month.toISOString(), month);
  }
  after(async () => {
    await Promise.all(
      [...months.entries()].map(([key, month]) =>
        enqueue(`${userId}:${key}`, () => syncMonthToSheet(userId, month)),
      ),
    );
  });
}
