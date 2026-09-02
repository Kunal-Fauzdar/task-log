"use server";

import { revalidatePath } from "next/cache";

import { createProject, deleteProject } from "@/lib/data/project";
import { projectInputSchema } from "@/lib/validation/project";
import { Prisma } from "../../generated/prisma/client.ts";
import type { ActionState } from "@/lib/actions/types";

// The project list feeds three surfaces: the Projects page itself, the task dialog's project
// picker on every /worklog/[date] page, and the Export page's per-project selector.
function revalidateProjectViews() {
  revalidatePath("/projects");
  revalidatePath("/worklog/[date]", "page");
  revalidatePath("/export");
}

export async function createProjectAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = projectInputSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await createProject({ name: parsed.data.name });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "Please fix the errors below.",
        fieldErrors: { name: ["A project with this name already exists"] },
      };
    }
    throw error;
  }

  revalidateProjectViews();
  return { status: "success" };
}

// Removing a project unassigns its tasks (schema: Task.projectId ON DELETE SET NULL) — the
// worklog day pages that showed those tasks under a project heading now show them under
// "No project", so those need revalidating too.
export async function deleteProjectAction(id: string): Promise<void> {
  await deleteProject(id);
  revalidateProjectViews();
}
