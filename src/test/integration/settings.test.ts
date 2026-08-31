// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { getWorkingDays, updateWorkingDays } from "@/lib/data/settings";
import { DEFAULT_WORKING_DAYS } from "@/lib/domain/settings";

// AppSettings is a genuine singleton (id: "singleton"), not a disposable fake-dated fixture like
// most other integration tests in this project — there's only ever one real row, and it's the
// one the running app actually reads. Snapshot it before the test and restore it after, rather
// than deleting/leaving test values behind in a row every other test (and the real app) shares.
let originalRow: { workingDays: number[] } | null = null;

beforeEach(async () => {
  originalRow = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
});

afterEach(async () => {
  if (originalRow) {
    await prisma.appSettings.update({
      where: { id: "singleton" },
      data: { workingDays: originalRow.workingDays },
    });
  } else {
    await prisma.appSettings.deleteMany({ where: { id: "singleton" } });
  }
});

describe("Settings (working days)", () => {
  it("creates the singleton row with the default on first read", async () => {
    await prisma.appSettings.deleteMany({ where: { id: "singleton" } });

    const workingDays = await getWorkingDays();
    expect(workingDays).toEqual(DEFAULT_WORKING_DAYS);

    const row = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    expect(row?.workingDays).toEqual(DEFAULT_WORKING_DAYS);
  });

  it("updates and persists a custom working-days configuration", async () => {
    const sunThu = [0, 1, 2, 3, 4];
    const updated = await updateWorkingDays(sunThu);
    expect(updated).toEqual(sunThu);

    const fetched = await getWorkingDays();
    expect(fetched).toEqual(sunThu);
  });
});
