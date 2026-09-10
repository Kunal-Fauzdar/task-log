// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getWorkingDays, updateWorkingDays } from "@/lib/data/settings";
import { DEFAULT_WORKING_DAYS } from "@/lib/domain/settings";
import { createTestUser, deleteTestUser } from "@/test/helpers/user";

// AppSettings is now one row per user (@@unique([userId])). Each test file gets its own
// throwaway user, so there's no shared singleton to snapshot/restore any more — deleting the
// user cascades its settings row away.
let userId: string;

beforeAll(async () => {
  userId = (await createTestUser()).id;
});

afterAll(async () => {
  await deleteTestUser(userId);
});

describe("Settings (working days)", () => {
  it("creates the row with the default on first read", async () => {
    const workingDays = await getWorkingDays(userId);
    expect(workingDays).toEqual(DEFAULT_WORKING_DAYS);
  });

  it("updates and persists a custom working-days configuration", async () => {
    const sunThu = [0, 1, 2, 3, 4];
    const updated = await updateWorkingDays(userId, sunThu);
    expect(updated).toEqual(sunThu);

    const fetched = await getWorkingDays(userId);
    expect(fetched).toEqual(sunThu);
  });

  it("keeps each user's working days independent", async () => {
    const other = await createTestUser();
    try {
      await updateWorkingDays(userId, [1, 2, 3]);
      await updateWorkingDays(other.id, [5, 6]);

      expect(await getWorkingDays(userId)).toEqual([1, 2, 3]);
      expect(await getWorkingDays(other.id)).toEqual([5, 6]);
    } finally {
      await deleteTestUser(other.id);
    }
  });
});
