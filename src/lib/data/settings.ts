import { prisma } from "@/lib/db";
import { DEFAULT_WORKING_DAYS } from "@/lib/domain/settings";

const SINGLETON_ID = "singleton";

// Upsert-on-read: the row may not exist yet (fresh database, or before this feature existed) —
// rather than requiring a seed step, reading it creates it with the default on first access.
export async function getWorkingDays(): Promise<number[]> {
  const settings = await prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, workingDays: DEFAULT_WORKING_DAYS },
    update: {},
  });
  return settings.workingDays;
}

export async function updateWorkingDays(workingDays: number[]): Promise<number[]> {
  const settings = await prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, workingDays },
    update: { workingDays },
  });
  return settings.workingDays;
}
