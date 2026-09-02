// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProject, deleteProject, listProjects } from "@/lib/data/project";
import { createWorkDay } from "@/lib/data/workday";
import { createTask, getTasksByWorkDay } from "@/lib/data/task";

const TEST_DATE = new Date("2099-04-01");
const NAME_A = "__test__ Project Alpha";
const NAME_B = "__test__ Project Beta";

afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: TEST_DATE } });
  await prisma.project.deleteMany({ where: { name: { in: [NAME_A, NAME_B] } } });
});

describe("Project data layer", () => {
  it("creates, lists (name-ordered), and deletes projects", async () => {
    await createProject({ name: NAME_B });
    await createProject({ name: NAME_A });

    const names = (await listProjects()).map((p) => p.name);
    expect(names.indexOf(NAME_A)).toBeLessThan(names.indexOf(NAME_B));

    const beta = (await listProjects()).find((p) => p.name === NAME_B)!;
    await deleteProject(beta.id);
    expect((await listProjects()).some((p) => p.name === NAME_B)).toBe(false);
  });

  it("deleting a project keeps its tasks, unassigning them (ON DELETE SET NULL)", async () => {
    const project = await createProject({ name: NAME_A });
    const workDay = await createWorkDay({ date: TEST_DATE });
    const task = await createTask({
      workDayId: workDay.id,
      taskId: "T-9001",
      description: "Filed under a project",
      projectId: project.id,
    });
    expect(task.projectId).toBe(project.id);

    await deleteProject(project.id);

    const [remaining] = await getTasksByWorkDay(workDay.id);
    expect(remaining.id).toBe(task.id);
    expect(remaining.projectId).toBeNull();
  });

  it("deleting an already-removed project returns null rather than throwing", async () => {
    const project = await createProject({ name: NAME_A });
    await deleteProject(project.id);
    await expect(deleteProject(project.id)).resolves.toBeNull();
  });
});
