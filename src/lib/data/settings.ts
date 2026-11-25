import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import { prisma } from "@/lib/db";
import { DEFAULT_WORKING_DAYS } from "@/lib/domain/settings";

// One AppSettings row per user (`@@unique([userId])`). Upsert-on-read: the row may not exist
// yet (a freshly-registered user) — reading it creates it with the default on first access,
// so there's no seed step.
export async function getWorkingDays(userId: string): Promise<number[]> {
  const settings = await prisma.appSettings.upsert({
    where: { userId },
    create: { userId, workingDays: DEFAULT_WORKING_DAYS },
    update: {},
  });
  return settings.workingDays;
}

export async function updateWorkingDays(userId: string, workingDays: number[]): Promise<number[]> {
  const settings = await prisma.appSettings.upsert({
    where: { userId },
    create: { userId, workingDays },
    update: { workingDays },
  });
  return settings.workingDays;
}

export type SheetSettings = {
  googleSheetId: string | null;
  sheetSyncedAt: Date | null;
  sheetSyncError: string | null;
  googleAccountEmail: string | null;
};

export async function getSheetSettings(userId: string): Promise<SheetSettings> {
  const settings = await prisma.appSettings.upsert({
    where: { userId },
    create: { userId, workingDays: DEFAULT_WORKING_DAYS },
    update: {},
    select: { googleSheetId: true, sheetSyncedAt: true, sheetSyncError: true, googleAccountEmail: true },
  });
  return settings;
}

// Linking (or unlinking, with null) resets the last sync outcome — it described the old sheet.
export async function updateGoogleSheetId(userId: string, googleSheetId: string | null) {
  await prisma.appSettings.upsert({
    where: { userId },
    create: { userId, workingDays: DEFAULT_WORKING_DAYS, googleSheetId },
    update: { googleSheetId, sheetSyncedAt: null, sheetSyncError: null },
  });
}

export async function recordSheetSyncResult(userId: string, error: string | null) {
  await prisma.appSettings.update({
    where: { userId },
    data: error ? { sheetSyncError: error } : { sheetSyncedAt: new Date(), sheetSyncError: null },
  });
}

// --- Connected Google account (OAuth) ---

export async function saveGoogleConnection(userId: string, refreshToken: string, email: string | null) {
  const data = {
    googleRefreshToken: encryptSecret(refreshToken),
    googleAccountEmail: email,
    sheetSyncError: null,
  };
  await prisma.appSettings.upsert({
    where: { userId },
    create: { userId, workingDays: DEFAULT_WORKING_DAYS, ...data },
    update: data,
  });
}

// Decrypted refresh token, or null if not connected (or undecryptable after a secret rotation).
export async function getGoogleRefreshToken(userId: string): Promise<string | null> {
  const row = await prisma.appSettings.findUnique({
    where: { userId },
    select: { googleRefreshToken: true },
  });
  return row?.googleRefreshToken ? decryptSecret(row.googleRefreshToken) : null;
}

export async function clearGoogleConnection(userId: string) {
  await prisma.appSettings.updateMany({
    where: { userId },
    data: { googleRefreshToken: null, googleAccountEmail: null },
  });
}
