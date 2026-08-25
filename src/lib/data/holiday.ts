import { prisma } from "@/lib/db";

export function createHoliday(data: { date: Date; name: string }) {
  return prisma.holiday.create({ data });
}

export function getHolidayByDate(date: Date) {
  return prisma.holiday.findUnique({ where: { date } });
}

export function listHolidays() {
  return prisma.holiday.findMany({ orderBy: { date: "asc" } });
}
