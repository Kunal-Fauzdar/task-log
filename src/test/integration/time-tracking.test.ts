// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createWorkDay,
  endBreak,
  endWork,
  startBreak,
  startWork,
  updateWorkDayTimes,
} from "@/lib/data/workday";
import {
  completeTaskTimer,
  createTask,
  deleteTask,
  pauseTaskTimer,
  resumeTaskTimer,
  startTaskTimer,
} from "@/lib/data/task";
import { createTestUser, deleteTestUser } from "@/test/helpers/user";

// Timer / time-tracking mutations return null when the record no longer exists or isn't the
// caller's (see tolerateAlreadyDeleted / the ownership guards in src/lib/data) — every call site
// below expects the record to genuinely exist, so this narrows the type.
function unwrap<T>(value: T | null): T {
  if (value === null) throw new Error("expected a non-null result");
  return value;
}

const TEST_DATE = new Date("2099-04-01");

let userId: string;

beforeAll(async () => {
  userId = (await createTestUser()).id;
});

afterAll(async () => {
  await deleteTestUser(userId);
});

afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { userId, date: TEST_DATE } });
});

function seedWorkDay() {
  return createWorkDay({ userId, date: TEST_DATE });
}

describe("startWork / endWork", () => {
  it("sets checkIn and moves status to IN_PROGRESS", async () => {
    const workDay = await seedWorkDay();
    const checkInAt = new Date(Date.UTC(2099, 3, 1, 10, 10, 0));

    const updated = unwrap(await startWork(userId, workDay.id, checkInAt));

    expect(updated.checkIn?.toISOString()).toBe(checkInAt.toISOString());
    expect(updated.status).toBe("IN_PROGRESS");
  });

  it("sets checkOut and moves status to COMPLETED", async () => {
    const workDay = await seedWorkDay();
    const checkInAt = new Date(Date.UTC(2099, 3, 1, 10, 10, 0));
    const checkOutAt = new Date(Date.UTC(2099, 3, 1, 19, 25, 0));

    await startWork(userId, workDay.id, checkInAt);
    const updated = unwrap(await endWork(userId, workDay.id, checkOutAt));

    expect(updated.checkOut?.toISOString()).toBe(checkOutAt.toISOString());
    expect(updated.status).toBe("COMPLETED");
  });

  it("endWork folds an in-progress break into breakSeconds instead of leaving it orphaned", async () => {
    const workDay = await seedWorkDay();
    await startWork(userId, workDay.id, new Date(Date.UTC(2099, 3, 1, 10, 0, 0)));
    const withBreak = unwrap(await startBreak(userId, workDay.id));
    expect(withBreak.breakStartedAt).not.toBeNull();

    const checkOutAt = new Date(Date.UTC(2099, 3, 1, 19, 0, 0));
    const updated = unwrap(await endWork(userId, workDay.id, checkOutAt));

    expect(updated.breakStartedAt).toBeNull();
    expect(updated.breakSeconds).toBeGreaterThanOrEqual(0);
  });

  it("does not act on another user's work day", async () => {
    const other = await createTestUser();
    try {
      const otherDay = await createWorkDay({ userId: other.id, date: TEST_DATE });
      await expect(
        startWork(userId, otherDay.id, new Date(Date.UTC(2099, 3, 1, 9, 0, 0))),
      ).resolves.toBeNull();
    } finally {
      await deleteTestUser(other.id);
    }
  });
});

describe("startBreak / endBreak", () => {
  it("accumulates elapsed break time and clears breakStartedAt", async () => {
    const workDay = await seedWorkDay();
    await startBreak(userId, workDay.id);
    const ended = unwrap(await endBreak(userId, workDay.id));

    expect(ended.breakStartedAt).toBeNull();
    expect(ended.breakSeconds).toBeGreaterThanOrEqual(0);
  });

  it("endBreak is a no-op when no break is active", async () => {
    const workDay = await seedWorkDay();
    const result = unwrap(await endBreak(userId, workDay.id));
    expect(result.breakStartedAt).toBeNull();
    expect(result.breakSeconds).toBe(0);
  });

  it("accumulates across multiple start/end cycles rather than resetting", async () => {
    const workDay = await seedWorkDay();
    await startBreak(userId, workDay.id);
    const first = unwrap(await endBreak(userId, workDay.id));
    await startBreak(userId, workDay.id);
    const second = unwrap(await endBreak(userId, workDay.id));

    expect(second.breakSeconds).toBeGreaterThanOrEqual(first.breakSeconds);
  });
});

describe("updateWorkDayTimes (manual correction)", () => {
  it("sets checkIn/checkOut/breakSeconds and derives status", async () => {
    const workDay = await seedWorkDay();
    const checkIn = new Date(Date.UTC(2099, 3, 1, 9, 0, 0));
    const checkOut = new Date(Date.UTC(2099, 3, 1, 17, 0, 0));

    const updated = unwrap(
      await updateWorkDayTimes(userId, workDay.id, { checkIn, checkOut, breakSeconds: 1800 }),
    );

    expect(updated.checkIn?.toISOString()).toBe(checkIn.toISOString());
    expect(updated.checkOut?.toISOString()).toBe(checkOut.toISOString());
    expect(updated.breakSeconds).toBe(1800);
    expect(updated.status).toBe("COMPLETED");
  });

  it("clearing checkIn/checkOut reverts status to NOT_STARTED", async () => {
    const workDay = await seedWorkDay();
    await updateWorkDayTimes(userId, workDay.id, {
      checkIn: new Date(Date.UTC(2099, 3, 1, 9, 0, 0)),
      checkOut: new Date(Date.UTC(2099, 3, 1, 17, 0, 0)),
      breakSeconds: 0,
    });

    const cleared = unwrap(
      await updateWorkDayTimes(userId, workDay.id, { checkIn: null, checkOut: null, breakSeconds: 0 }),
    );

    expect(cleared.status).toBe("NOT_STARTED");
  });
});

describe("Task timer", () => {
  it("start -> pause accumulates elapsed time into durationSeconds", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Work" });

    const started = unwrap(await startTaskTimer(userId, task.id));
    expect(started.timerStatus).toBe("RUNNING");
    expect(started.timerStartedAt).not.toBeNull();

    const paused = unwrap(await pauseTaskTimer(userId, task.id));
    expect(paused.timerStatus).toBe("PAUSED");
    expect(paused.timerStartedAt).toBeNull();
    expect(paused.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it("pause is a no-op when not running", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({
      workDayId: workDay.id,
      taskId: "T-1",
      description: "Work",
      durationSeconds: 500,
    });

    const result = unwrap(await pauseTaskTimer(userId, task.id));
    expect(result.durationSeconds).toBe(500);
    expect(result.timerStatus).toBe("NONE");
  });

  it("resume sets RUNNING again without resetting accumulated duration", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Work" });

    await startTaskTimer(userId, task.id);
    const paused = unwrap(await pauseTaskTimer(userId, task.id));
    const resumed = unwrap(await resumeTaskTimer(userId, task.id));

    expect(resumed.timerStatus).toBe("RUNNING");
    expect(resumed.durationSeconds).toBe(paused.durationSeconds);
  });

  it("complete folds any running elapsed time and finalizes the timer", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Work" });

    await startTaskTimer(userId, task.id);
    const completed = unwrap(await completeTaskTimer(userId, task.id));

    expect(completed.timerStatus).toBe("COMPLETED");
    expect(completed.timerStartedAt).toBeNull();
    expect(completed.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it("complete from PAUSED keeps the already-accumulated duration", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({
      workDayId: workDay.id,
      taskId: "T-1",
      description: "Work",
      durationSeconds: 1200,
    });

    await startTaskTimer(userId, task.id);
    const paused = unwrap(await pauseTaskTimer(userId, task.id));
    const completed = unwrap(await completeTaskTimer(userId, task.id));

    expect(completed.durationSeconds).toBe(paused.durationSeconds);
    expect(completed.timerStatus).toBe("COMPLETED");
  });

  it("timer mutations on an already-deleted task return null instead of throwing", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Work" });
    await deleteTask(userId, task.id);

    await expect(startTaskTimer(userId, task.id)).resolves.toBeNull();
    await expect(pauseTaskTimer(userId, task.id)).resolves.toBeNull();
    await expect(resumeTaskTimer(userId, task.id)).resolves.toBeNull();
    await expect(completeTaskTimer(userId, task.id)).resolves.toBeNull();
  });
});
