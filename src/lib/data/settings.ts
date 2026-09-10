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
