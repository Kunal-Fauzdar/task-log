// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createWorkDay, getRecentWorkDays } from "@/lib/data/workday";
import { createTask } from "@/lib/data/task";

const TEST_DATE_STARTED = new Date("2099-07-01");
const TEST_DATE_EMPTY = new Date("2099-07-02");
const TEST_DATE_HOLIDAY = new Date("2099-07-03");
const TEST_DATE_WITH_TASK = new Date("2099-07-04");

afterEach(async () => {
  await prisma.workDay.deleteMany({
    where: {
      date: { in: [TEST_DATE_STARTED, TEST_DATE_EMPTY, TEST_DATE_HOLIDAY, TEST_DATE_WITH_TASK] },
    },
  });
});

describe("getRecentWorkDays", () => {
  it("excludes empty NOT_STARTED days with no tasks", async () => {
    await createWorkDay({ date: TEST_DATE_EMPTY });

    const recent = await getRecentWorkDays(50);
    const dates = recent.map((w) => w.date.toISOString().slice(0, 10));

    expect(dates).not.toContain("2099-07-02");
  });

  it("includes a day with checkIn set (IN_PROGRESS)", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_STARTED });
    await prisma.workDay.update({
      where: { id: workDay.id },
      data: { checkIn: new Date(), status: "IN_PROGRESS" },
    });

    const recent = await getRecentWorkDays(50);
    const dates = recent.map((w) => w.date.toISOString().slice(0, 10));

    expect(dates).toContain("2099-07-01");
  });

  it("includes a holiday day even with no tasks or check-in", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_HOLIDAY });
    await prisma.workDay.update({
      where: { id: workDay.id },
      data: { dayType: "HOLIDAY", status: "HOLIDAY" },
    });

    const recent = await getRecentWorkDays(50);
    const dates = recent.map((w) => w.date.toISOString().slice(0, 10));

    expect(dates).toContain("2099-07-03");
  });

  it("includes a NOT_STARTED day that has a task", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_WITH_TASK });
    await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Something" });

    const recent = await getRecentWorkDays(50);
    const dates = recent.map((w) => w.date.toISOString().slice(0, 10));

    expect(dates).toContain("2099-07-04");
  });
});
