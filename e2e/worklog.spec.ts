import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { formatDisplayDate, parseDateOnly } from "../src/lib/domain/date";

// A clearly-fake far-future date so this test can never collide with real logged work.
const TEST_DATE_PARAM = "2099-05-15";
const TEST_DATE = parseDateOnly(TEST_DATE_PARAM);

test.afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: TEST_DATE } });
});

test("work log day: add, edit, and delete a task; toggle holiday", async ({ page }) => {
  await page.goto(`/worklog/${TEST_DATE_PARAM}`);

  await expect(page.getByRole("heading", { name: formatDisplayDate(TEST_DATE) })).toBeVisible();
  await expect(page.getByText("No tasks logged for this day yet.")).toBeVisible();

  // Add a task
  await page.getByRole("button", { name: "+ Add Task" }).click();
  await page.getByLabel("Task ID").fill("T-1039");
  await page
    .getByLabel("Task description")
    .fill("Completed add finisher name and phone number in all services page.");
  await page.getByLabel("Duration (H:MM:SS)").fill("4:00:00");
  await page.getByLabel("Link (optional)").fill("https://example.com/T-1039");
  await page.getByRole("button", { name: "Save" }).click();

  const row = page.getByRole("row", { name: /T-1039/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("4:00:00")).toBeVisible();
  await expect(page.getByText("Total task duration: 4:00:00")).toBeVisible();

  // Edit the task
  await row.getByRole("button", { name: "Edit T-1039" }).click();
  await page.getByLabel("Duration (H:MM:SS)").fill("2:00:00");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Total task duration: 2:00:00")).toBeVisible();

  // Holiday toggle reveals the reason field, and actually persists in both directions — not
  // just a client-side visibility check. A prior version of this test only toggled the switch
  // without ever saving, which missed a real bug: unmarking a holiday and saving always failed
  // validation (FormData.get() returns null, not undefined, for the now-absent holidayReason
  // field, and Zod's .optional() rejects null) — see CLAUDE.md §3.
  await page.getByRole("switch", { name: "Mark as holiday" }).click();
  await page.getByLabel("Holiday reason").fill("Phase 11 QA Holiday");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Mark as holiday" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByLabel("Holiday reason")).toHaveValue("Phase 11 QA Holiday");
  await expect(page.locator('[data-slot="badge"]', { hasText: "Holiday" })).toBeVisible();

  await page.getByRole("switch", { name: "Mark as holiday" }).click();
  await expect(page.getByLabel("Holiday reason")).toHaveCount(0);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Mark as holiday" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.getByLabel("Holiday reason")).toHaveCount(0);

  // Delete the task, with the accessible confirmation dialog
  await row.getByRole("button", { name: "Delete T-1039" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("No tasks logged for this day yet.")).toBeVisible();
});

// Own dedicated date + local cleanup, not the shared top-level afterEach — this test deletes
// the WorkDay itself, and playwright.config.ts's fullyParallel: true means sharing TEST_DATE
// with the test above risks exactly the cross-test race CLAUDE.md documents from Phase 8.
test("deleting a work day removes it and its tasks, and redirects to the dashboard", async ({
  page,
}) => {
  const deleteTestDateParam = "2099-05-16";
  const deleteTestDate = parseDateOnly(deleteTestDateParam);

  try {
    await page.goto(`/worklog/${deleteTestDateParam}`);
    await page.getByRole("button", { name: "+ Add Task" }).click();
    await page.getByLabel("Task ID").fill("T-2001");
    await page.getByLabel("Task description").fill("Will be deleted with its day");
    await page.getByLabel("Duration (H:MM:SS)").fill("1:00:00");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("row", { name: /T-2001/ })).toBeVisible();

    await page.getByRole("button", { name: "Delete Work Day" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);

    const workDay = await prisma.workDay.findUnique({ where: { date: deleteTestDate } });
    expect(workDay).toBeNull();
  } finally {
    await prisma.workDay.deleteMany({ where: { date: deleteTestDate } });
  }
});
