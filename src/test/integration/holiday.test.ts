// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createHoliday, getHolidayByDate, listHolidays } from "@/lib/data/holiday";

const TEST_DATE = new Date("2099-06-15");

afterEach(async () => {
  await prisma.holiday.deleteMany({ where: { date: TEST_DATE } });
});

describe("Holiday", () => {
  it("creates and fetches a holiday by date", async () => {
    await createHoliday({ date: TEST_DATE, name: "Test Holiday" });

    const found = await getHolidayByDate(TEST_DATE);
    expect(found?.name).toBe("Test Holiday");
  });

  it("enforces one holiday per date", async () => {
    await createHoliday({ date: TEST_DATE, name: "Test Holiday" });
    await expect(
      createHoliday({ date: TEST_DATE, name: "Duplicate" }),
    ).rejects.toThrow();
  });

  it("lists holidays in ascending date order", async () => {
    await createHoliday({ date: TEST_DATE, name: "Test Holiday" });
    const all = await listHolidays();
    const dates = all.map((h) => h.date.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});
