import { prisma } from "@/lib/db";

// Per-user reference calendar (see CLAUDE.md §3/§4). No UI builds on these yet — they exist for
// a future "known holidays" feature and are covered by integration tests.

export function createHoliday(data: { userId: string; date: Date; name: string }) {
  return prisma.holiday.create({ data });
}

export function getHolidayByDate(userId: string, date: Date) {
  return prisma.holiday.findUnique({ where: { userId_date: { userId, date } } });
}

export function listHolidays(userId: string) {
  return prisma.holiday.findMany({ where: { userId }, orderBy: { date: "asc" } });
}
