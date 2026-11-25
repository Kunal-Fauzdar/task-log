"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { getServerToday } from "@/lib/data/export-data";
import {
  clearGoogleConnection,
  getGoogleRefreshToken,
  updateGoogleSheetId,
  updateWorkingDays,
} from "@/lib/data/settings";
import { revokeToken } from "@/lib/sheets/google-oauth";
import { extractSpreadsheetId } from "@/lib/domain/sheets";
import { syncMonthToSheet } from "@/lib/sheets/sync";
import { googleSheetLinkSchema, workingDaysSchema } from "@/lib/validation/settings";
import type { ActionState } from "@/lib/actions/types";

export async function updateWorkingDaysAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = workingDaysSchema.safeParse({
    workingDays: formData.getAll("workingDays"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await updateWorkingDays(user.id, parsed.data.workingDays);

  // Export reads working days live on every request, so nothing there needs revalidating — only
  // the Settings page itself shows this value.
  revalidatePath("/settings");
  return { status: "success" };
}

export async function updateGoogleSheetAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = googleSheetLinkSchema.safeParse({ sheetUrl: formData.get("sheetUrl") ?? "" });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!parsed.data.sheetUrl) {
    await updateGoogleSheetId(user.id, null);
    revalidatePath("/settings");
    return { status: "success", message: "Google Sheet unlinked." };
  }

  const spreadsheetId = extractSpreadsheetId(parsed.data.sheetUrl);
  if (!spreadsheetId) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { sheetUrl: ["Paste a Google Sheets link (https://docs.google.com/spreadsheets/d/…)"] },
    };
  }

  await updateGoogleSheetId(user.id, spreadsheetId);
  // Sync the current month straight away (synchronously, not via `after`) so the user finds out
  // right here whether the sheet is shared correctly, instead of on their next task save.
  const result = await syncMonthToSheet(user.id, getServerToday());
  revalidatePath("/settings");
  return result.ok
    ? { status: "success", message: "Linked — this month has been written to the sheet." }
    : { status: "error", message: result.error };
}

// "Sync now" — rewrites the current and previous month tabs (the previous one catches late edits
// made around a month boundary, or anything a failed automatic sync missed).
export async function syncGoogleSheetNowAction(): Promise<ActionState> {
  const user = await requireUser();
  const thisMonth = getServerToday();
  const lastMonth = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - 1, 1));
  for (const month of [lastMonth, thisMonth]) {
    const result = await syncMonthToSheet(user.id, month);
    if (!result.ok) {
      revalidatePath("/settings");
      return { status: "error", message: result.error };
    }
  }
  revalidatePath("/settings");
  return { status: "success", message: "Sheet is up to date." };
}

// Forget the connected Google account (and revoke the token at Google, best effort). The linked
// sheet id is kept — reconnecting resumes syncing to the same sheet.
export async function disconnectGoogleAction(): Promise<void> {
  const user = await requireUser();
  const refreshToken = await getGoogleRefreshToken(user.id);
  await clearGoogleConnection(user.id);
  if (refreshToken) await revokeToken(refreshToken);
  revalidatePath("/settings");
}
