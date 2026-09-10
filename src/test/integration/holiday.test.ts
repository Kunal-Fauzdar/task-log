// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createHoliday, getHolidayByDate, listHolidays } from "@/lib/data/holiday";
import { createTestUser, deleteTestUser } from "@/test/helpers/user";

const TEST_DATE = new Date("2099-06-15");

let userId: string;

beforeAll(async () => {
  userId = (await createTestUser()).id;
});

afterAll(async () => {
  await deleteTestUser(userId);
});

afterEach(async () => {
  await prisma.holiday.deleteMany({ where: { userId, date: TEST_DATE } });
});

describe("Holiday", () => {
  it("creates and fetches a holiday by date", async () => {
    await createHoliday({ userId, date: TEST_DATE, name: "Test Holiday" });

    const found = await getHolidayByDate(userId, TEST_DATE);
    expect(found?.name).toBe("Test Holiday");
  });

  it("enforces one holiday per date per user", async () => {
    await createHoliday({ userId, date: TEST_DATE, name: "Test Holiday" });
    await expect(
      createHoliday({ userId, date: TEST_DATE, name: "Duplicate" }),
    ).rejects.toThrow();
  });

  it("lets a different user have a holiday on the same date", async () => {
    const other = await createTestUser();
    try {
      await createHoliday({ userId, date: TEST_DATE, name: "Mine" });
      await expect(
        createHoliday({ userId: other.id, date: TEST_DATE, name: "Theirs" }),
      ).resolves.toBeTruthy();
    } finally {
      await deleteTestUser(other.id);
    }
  });

  it("lists holidays in ascending date order, scoped to the user", async () => {
    await createHoliday({ userId, date: TEST_DATE, name: "Test Holiday" });
    const all = await listHolidays(userId);
    const dates = all.map((h) => h.date.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});
