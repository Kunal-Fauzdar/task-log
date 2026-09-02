import { test, expect } from "@playwright/test";

import { prisma } from "../src/lib/db";
import { parseDateOnly } from "../src/lib/domain/date";

const PROJECT_NAME = "__e2e__ Project Timesheet";
const DATE_PARAM = "2099-08-20";
const TEST_DATE = parseDateOnly(DATE_PARAM);

test.afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: TEST_DATE } });
  await prisma.project.deleteMany({ where: { name: PROJECT_NAME } });
});

test("create a project, file a task under it, export its timesheet, then remove it", async ({
  page,
}) => {
  // Add the project
  await page.goto("/projects");
  await page.getByLabel("Project name").fill(PROJECT_NAME);
  await page.getByRole("button", { name: "Add Project" }).click();
  await expect(page.getByText(PROJECT_NAME)).toBeVisible();

  // File a task under it on a work day
  await page.goto(`/worklog/${DATE_PARAM}`);
  await page.getByRole("button", { name: "Add Task" }).click();
  await page.getByLabel("Project", { exact: true }).selectOption({ label: PROJECT_NAME });
  await page.getByLabel("Task ID").fill("T-7700");
  await page.getByLabel("Task description").fill("Task in a project timesheet");
  await page.getByLabel("Duration (H:MM:SS)").fill("1:00:00");
  await page.getByRole("button", { name: "Save" }).click();

  // It renders under the project's own section heading — and since it's the only task and it has
  // a project, there is no "No project" group at all.
  await expect(page.getByRole("heading", { level: 3, name: PROJECT_NAME })).toBeVisible();
  await expect(page.getByRole("row", { name: /T-7700/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "No project" })).toHaveCount(0);

  // Per-project export: same route, filtered, filename carries the project slug
  const project = await prisma.project.findUniqueOrThrow({ where: { name: PROJECT_NAME } });
  const response = await page.request.get(
    `/api/export?type=day&date=${DATE_PARAM}&projectId=${project.id}`,
  );
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-disposition"]).toContain("Project-Timesheet");

  // Remove the project — its task survives, unassigned
  await page.goto("/projects");
  await page
    .getByRole("listitem")
    .filter({ hasText: PROJECT_NAME })
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(PROJECT_NAME)).toHaveCount(0);

  const task = await prisma.task.findFirstOrThrow({ where: { taskId: "T-7700" } });
  expect(task.projectId).toBeNull();
});
