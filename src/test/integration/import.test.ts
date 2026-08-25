// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createWorkDay } from "@/lib/data/workday";
import { importWorkDayGroups } from "@/lib/data/import";
import type { ImportGroupInput } from "@/lib/validation/import";

const TEST_DATE_EXISTING = new Date("2099-09-10");
const TEST_DATE_NEW = new Date("2099-09-11");
const TEST_DATE_HOLIDAY = new Date("2099-09-12");

afterEach(async () => {
  await prisma.workDay.deleteMany({
    where: { date: { in: [TEST_DATE_EXISTING, TEST_DATE_NEW, TEST_DATE_HOLIDAY] } },
  });
});

describe("importWorkDayGroups — real database data end to end", () => {
  it("imports new days, skips a day that already exists, and never overwrites it", async () => {
    const existing = await createWorkDay({ date: TEST_DATE_EXISTING });
    await prisma.workDay.update({
      where: { id: existing.id },
      data: { notes: "Original notes — must survive the import untouched" },
    });

    const groups: ImportGroupInput[] = [
      {
        date: "2099-09-10", // duplicate — must be skipped, not overwritten
        isHoliday: false,
        holidayReason: null,
        checkIn: "09:00",
        checkOut: "17:00",
        breakSeconds: 1800,
        tasks: [
          { taskId: "T-9001", description: "Should not be imported", durationSeconds: 3600, link: null },
        ],
      },
      {
        date: "2099-09-11", // new — should import with two tasks
        isHoliday: false,
        holidayReason: null,
        checkIn: "09:00",
        checkOut: "18:00",
        breakSeconds: 3600,
        tasks: [
          { taskId: "T-9002", description: "First task", durationSeconds: 3600, link: "https://example.com/T-9002" },
          { taskId: "T-9003", description: "Second task", durationSeconds: 1800, link: null },
        ],
      },
      {
        date: "2099-09-12", // new — holiday, no tasks
        isHoliday: true,
        holidayReason: "Test Holiday",
        checkIn: null,
        checkOut: null,
        breakSeconds: 0,
        tasks: [],
      },
    ];

    const outcome = await importWorkDayGroups(groups);

    expect(outcome.importedCount).toBe(2);
    expect(outcome.skippedDuplicates).toEqual(["2099-09-10"]);
    expect(outcome.failed).toEqual([]);

    const untouchedExisting = await prisma.workDay.findUnique({ where: { date: TEST_DATE_EXISTING } });
    expect(untouchedExisting?.notes).toBe("Original notes — must survive the import untouched");
    const existingTasks = await prisma.task.findMany({ where: { workDayId: existing.id } });
    expect(existingTasks).toEqual([]);

    const newWorkDay = await prisma.workDay.findUnique({
      where: { date: TEST_DATE_NEW },
      include: { tasks: { orderBy: { order: "asc" } } },
    });
    expect(newWorkDay?.status).toBe("COMPLETED");
    expect(newWorkDay?.breakSeconds).toBe(3600);
    expect(newWorkDay?.tasks).toHaveLength(2);
    expect(newWorkDay?.tasks[0]).toMatchObject({ taskId: "T-9002", link: "https://example.com/T-9002" });
    expect(newWorkDay?.tasks[1]).toMatchObject({ taskId: "T-9003", link: null });

    const holidayWorkDay = await prisma.workDay.findUnique({ where: { date: TEST_DATE_HOLIDAY } });
    expect(holidayWorkDay?.status).toBe("HOLIDAY");
    expect(holidayWorkDay?.holidayReason).toBe("Test Holiday");
  });
});
