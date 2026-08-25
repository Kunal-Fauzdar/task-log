// Permissive by design (CLAUDE.md §5): letters, a dash, digits — e.g. "T-1039". Not tied to
// a specific prefix so the user can adopt whatever ticket-ID convention their tracker uses.
export const TASK_ID_PATTERN = /^[A-Za-z]+-\d+$/;

export function isValidTaskId(taskId: string): boolean {
  return TASK_ID_PATTERN.test(taskId.trim());
}

// `durationSeconds` only holds *completed* elapsed time. While the timer is RUNNING, the true
// elapsed time also includes time since `timerStartedAt` — this is what should be summed for
// "Total Task Duration" (spec §12), not the raw stored field, or a long-running active timer
// wouldn't count until paused/completed.
export function getEffectiveTaskSeconds(
  task: { durationSeconds: number; timerStatus: string; timerStartedAt: Date | null },
  now: Date,
): number {
  if (task.timerStatus !== "RUNNING" || !task.timerStartedAt) return task.durationSeconds;
  const elapsedSinceStart = Math.max(
    0,
    Math.round((now.getTime() - task.timerStartedAt.getTime()) / 1000),
  );
  return task.durationSeconds + elapsedSinceStart;
}
