import { describe, expect, it } from "vitest";

import { getEffectiveTaskSeconds } from "@/lib/domain/task";

describe("getEffectiveTaskSeconds", () => {
  it("returns durationSeconds as-is when not running", () => {
    const now = new Date();
    expect(
      getEffectiveTaskSeconds(
        { durationSeconds: 1800, timerStatus: "NONE", timerStartedAt: null },
        now,
      ),
    ).toBe(1800);
    expect(
      getEffectiveTaskSeconds(
        { durationSeconds: 1800, timerStatus: "PAUSED", timerStartedAt: null },
        now,
      ),
    ).toBe(1800);
  });

  it("adds elapsed time since timerStartedAt when running", () => {
    const startedAt = new Date(Date.now() - 90_000); // 90s ago
    const now = new Date();
    const effective = getEffectiveTaskSeconds(
      { durationSeconds: 1800, timerStatus: "RUNNING", timerStartedAt: startedAt },
      now,
    );
    expect(effective).toBeGreaterThanOrEqual(1800 + 89);
    expect(effective).toBeLessThanOrEqual(1800 + 91);
  });

  it("never returns less than durationSeconds even if timerStartedAt is in the future", () => {
    const startedAt = new Date(Date.now() + 60_000);
    const now = new Date();
    expect(
      getEffectiveTaskSeconds(
        { durationSeconds: 1800, timerStatus: "RUNNING", timerStartedAt: startedAt },
        now,
      ),
    ).toBe(1800);
  });
});
