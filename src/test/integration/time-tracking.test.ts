// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

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

// Timer mutations return null when the task no longer exists (see tolerateAlreadyDeleted in
// src/lib/data/task.ts) — every call site below expects the task to genuinely exist, so this
// narrows the type instead of repeating a null check everywhere.
function unwrap<T>(value: T | null): T {
  if (value === null) throw new Error("expected a non-null result");
  return value;
}

const TEST_DATE = new Date("2099-04-01");

afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: TEST_DATE } });
});

async function seedWorkDay() {
  return createWorkDay({ date: TEST_DATE });
}

describe("startWork / endWork", () => {
  it("sets checkIn and moves status to IN_PROGRESS", async () => {
    const workDay = await seedWorkDay();
    const checkInAt = new Date(Date.UTC(2099, 3, 1, 10, 10, 0));

    const updated = await startWork(workDay.id, checkInAt);

    expect(updated.checkIn?.toISOString()).toBe(checkInAt.toISOString());
    expect(updated.status).toBe("IN_PROGRESS");
  });

  it("sets checkOut and moves status to COMPLETED", async () => {
    const workDay = await seedWorkDay();
    const checkInAt = new Date(Date.UTC(2099, 3, 1, 10, 10, 0));
    const checkOutAt = new Date(Date.UTC(2099, 3, 1, 19, 25, 0));

    await startWork(workDay.id, checkInAt);
    const updated = await endWork(workDay.id, checkOutAt);

    expect(updated.checkOut?.toISOString()).toBe(checkOutAt.toISOString());
    expect(updated.status).toBe("COMPLETED");
  });

  it("endWork folds an in-progress break into breakSeconds instead of leaving it orphaned", async () => {
    const workDay = await seedWorkDay();
    await startWork(workDay.id, new Date(Date.UTC(2099, 3, 1, 10, 0, 0)));
    const withBreak = await startBreak(workDay.id);
    expect(withBreak.breakStartedAt).not.toBeNull();

    const checkOutAt = new Date(Date.UTC(2099, 3, 1, 19, 0, 0));
    const updated = await endWork(workDay.id, checkOutAt);

    expect(updated.breakStartedAt).toBeNull();
    expect(updated.breakSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe("startBreak / endBreak", () => {
  it("accumulates elapsed break time and clears breakStartedAt", async () => {
    const workDay = await seedWorkDay();
    await startBreak(workDay.id);
    const ended = await endBreak(workDay.id);

    expect(ended.breakStartedAt).toBeNull();
    expect(ended.breakSeconds).toBeGreaterThanOrEqual(0);
  });

  it("endBreak is a no-op when no break is active", async () => {
    const workDay = await seedWorkDay();
    const result = await endBreak(workDay.id);
    expect(result.breakStartedAt).toBeNull();
    expect(result.breakSeconds).toBe(0);
  });

  it("accumulates across multiple start/end cycles rather than resetting", async () => {
    const workDay = await seedWorkDay();
    await startBreak(workDay.id);
    const first = await endBreak(workDay.id);
    await startBreak(workDay.id);
    const second = await endBreak(workDay.id);

    expect(second.breakSeconds).toBeGreaterThanOrEqual(first.breakSeconds);
  });
});

describe("updateWorkDayTimes (manual correction)", () => {
  it("sets checkIn/checkOut/breakSeconds and derives status", async () => {
    const workDay = await seedWorkDay();
    const checkIn = new Date(Date.UTC(2099, 3, 1, 9, 0, 0));
    const checkOut = new Date(Date.UTC(2099, 3, 1, 17, 0, 0));

    const updated = await updateWorkDayTimes(workDay.id, {
      checkIn,
      checkOut,
      breakSeconds: 1800,
    });

    expect(updated.checkIn?.toISOString()).toBe(checkIn.toISOString());
    expect(updated.checkOut?.toISOString()).toBe(checkOut.toISOString());
    expect(updated.breakSeconds).toBe(1800);
    expect(updated.status).toBe("COMPLETED");
  });

  it("clearing checkIn/checkOut reverts status to NOT_STARTED", async () => {
    const workDay = await seedWorkDay();
    await updateWorkDayTimes(workDay.id, {
      checkIn: new Date(Date.UTC(2099, 3, 1, 9, 0, 0)),
      checkOut: new Date(Date.UTC(2099, 3, 1, 17, 0, 0)),
      breakSeconds: 0,
    });

    const cleared = await updateWorkDayTimes(workDay.id, {
      checkIn: null,
      checkOut: null,
      breakSeconds: 0,
    });

    expect(cleared.status).toBe("NOT_STARTED");
  });
});

describe("Task timer", () => {
  it("start -> pause accumulates elapsed time into durationSeconds", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Work" });

    const started = unwrap(await startTaskTimer(task.id));
    expect(started.timerStatus).toBe("RUNNING");
    expect(started.timerStartedAt).not.toBeNull();

    const paused = unwrap(await pauseTaskTimer(task.id));
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

    const result = unwrap(await pauseTaskTimer(task.id));
    expect(result.durationSeconds).toBe(500);
    expect(result.timerStatus).toBe("NONE");
  });

  it("resume sets RUNNING again without resetting accumulated duration", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Work" });

    await startTaskTimer(task.id);
    const paused = unwrap(await pauseTaskTimer(task.id));
    const resumed = unwrap(await resumeTaskTimer(task.id));

    expect(resumed.timerStatus).toBe("RUNNING");
    expect(resumed.durationSeconds).toBe(paused.durationSeconds);
  });

  it("complete folds any running elapsed time and finalizes the timer", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Work" });

    await startTaskTimer(task.id);
    const completed = unwrap(await completeTaskTimer(task.id));

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

    await startTaskTimer(task.id);
    const paused = unwrap(await pauseTaskTimer(task.id));
    const completed = unwrap(await completeTaskTimer(task.id));

    expect(completed.durationSeconds).toBe(paused.durationSeconds);
    expect(completed.timerStatus).toBe("COMPLETED");
  });

  it("timer mutations on an already-deleted task return null instead of throwing", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Work" });
    await deleteTask(task.id);

    await expect(startTaskTimer(task.id)).resolves.toBeNull();
    await expect(pauseTaskTimer(task.id)).resolves.toBeNull();
    await expect(resumeTaskTimer(task.id)).resolves.toBeNull();
    await expect(completeTaskTimer(task.id)).resolves.toBeNull();
  });
});
