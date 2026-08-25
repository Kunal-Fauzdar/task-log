import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { createWorkDay } from "../src/lib/data/workday";
import { createTask, setTaskSkills } from "../src/lib/data/task";
import { createSkill, deleteSkill } from "../src/lib/data/skill";

// A dedicated date/skill name per test, not shared at file scope — playwright.config.ts sets
// fullyParallel: true, so the two tests in this file run concurrently in separate workers. A
// shared TEST_DATE with a top-level test.afterEach previously caused the "invalid range" test's
// cleanup to delete-cascade the seeding test's WorkDay/Task mid-request (an intermittent
// TypeError: Cannot read properties of null (reading 'date') in groupTasksByDate) — each test
// now owns cleanup for only the data it creates.
const SEEDED_TEST_DATE = new Date("2099-12-20");
const SKILL_NAME = "Playwright Reports Skill 2099";

test("reports page shows aggregated stats and tables for a filtered date range", async ({ page }) => {
  const skill = await createSkill({ name: SKILL_NAME, proficiencyPercentage: 40 });
  const workDay = await createWorkDay({ date: SEEDED_TEST_DATE });
  await prisma.workDay.update({
    where: { id: workDay.id },
    data: {
      checkIn: new Date(Date.UTC(2099, 11, 20, 9, 0, 0)),
      checkOut: new Date(Date.UTC(2099, 11, 20, 17, 0, 0)),
      status: "COMPLETED",
    },
  });
  const task = await createTask({
    workDayId: workDay.id,
    taskId: "T-9001",
    description: "Reports e2e task",
    durationSeconds: 3600,
  });
  await setTaskSkills(task.id, [skill.id]);

  try {
    await page.goto("/reports?from=2099-12-20&to=2099-12-20");

    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

    // Work Summary — precise math is covered by unit/integration tests; here just confirm the
    // tile renders with a real (non-placeholder) duration value.
    await expect(page.getByText("Total working days")).toBeVisible();
    await expect(page.getByText("8:00:00").first()).toBeVisible();

    // Task Summary — the recurring Task ID row
    await expect(page.getByRole("cell", { name: "T-9001" })).toBeVisible();

    // Skill Usage — the tagged skill shows up with its task count
    await expect(page.getByRole("cell", { name: SKILL_NAME })).toBeVisible();

    // Monthly Summary
    await expect(page.getByText("December 2099")).toBeVisible();
  } finally {
    await prisma.workDay.deleteMany({ where: { date: SEEDED_TEST_DATE } });
    await deleteSkill(skill.id);
  }
});

test("reports page falls back to the current month when the range is invalid", async ({ page }) => {
  await page.goto("/reports?from=2099-12-20&to=2099-01-01");

  // `to` before `from` is rejected — the page renders without crashing, filter inputs fall back
  // to the current month rather than the invalid values.
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  const fromValue = await page.locator("#report-from").inputValue();
  expect(fromValue).not.toBe("2099-12-20");
});
