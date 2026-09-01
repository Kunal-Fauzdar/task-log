import { prisma } from "@/lib/db";
import { combineDateAndTime, parseDateOnly } from "@/lib/domain/date";
import { deriveWorkDayStatus } from "@/lib/domain/workday";
import type { ImportGroupInput } from "@/lib/validation/import";

export type ImportOutcome = {
  importedCount: number;
  skippedDuplicates: string[];
  failed: { date: string; message: string }[];
};

// Never overwrites an existing WorkDay (spec §30: "Do not overwrite existing data
// automatically") — a date that already has a WorkDay row is skipped, not merged or replaced.
// Each group is its own transaction so one bad day can't roll back an otherwise-successful batch
// import.
export async function importWorkDayGroups(groups: ImportGroupInput[]): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { importedCount: 0, skippedDuplicates: [], failed: [] };

  for (const group of groups) {
    const date = parseDateOnly(group.date);
    try {
      const existing = await prisma.workDay.findUnique({ where: { date } });
      if (existing) {
        outcome.skippedDuplicates.push(group.date);
        continue;
      }

      const checkIn = group.checkIn ? combineDateAndTime(date, group.checkIn) : null;
      const checkOut = group.checkOut ? combineDateAndTime(date, group.checkOut) : null;
      const dayNote = group.dayNote?.trim() || null;

      await prisma.$transaction(async (tx) => {
        const workDay = await tx.workDay.create({
          data: {
            date,
            checkIn,
            checkOut,
            breakSeconds: group.breakSeconds,
            dayType: group.dayType,
            dayNote,
            status: deriveWorkDayStatus({ checkIn, checkOut, dayType: group.dayType }),
          },
        });

        let order = 0;
        for (const task of group.tasks) {
          await tx.task.create({
            data: {
              workDayId: workDay.id,
              taskId: task.taskId,
              description: task.description,
              durationSeconds: task.durationSeconds,
              link: task.link || null,
              order: order++,
            },
          });
        }
      });
      outcome.importedCount += 1;
    } catch {
      outcome.failed.push({ date: group.date, message: "Could not import this day." });
    }
  }

  return outcome;
}
