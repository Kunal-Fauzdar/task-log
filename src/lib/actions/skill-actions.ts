"use server";

import { revalidatePath } from "next/cache";

import { skillInputSchema } from "@/lib/validation/skill";
import { createSkill, deleteSkill, updateSkill } from "@/lib/data/skill";
import { Prisma } from "../../generated/prisma/client.ts";
import type { ActionState } from "@/lib/actions/types";

function parseSkillForm(formData: FormData) {
  return skillInputSchema.safeParse({
    name: formData.get("name"),
    proficiencyPercentage: formData.get("proficiencyPercentage"),
    notes: formData.get("notes"),
  });
}

export async function createSkillAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseSkillForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await createSkill({
      name: parsed.data.name,
      proficiencyPercentage: parsed.data.proficiencyPercentage,
      notes: parsed.data.notes || undefined,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "Please fix the errors below.",
        fieldErrors: { name: ["A skill with this name already exists"] },
      };
    }
    throw error;
  }

  revalidatePath("/skills");
  return { status: "success" };
}

export async function updateSkillAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");

  const parsed = parseSkillForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateSkill(id, {
      name: parsed.data.name,
      proficiencyPercentage: parsed.data.proficiencyPercentage,
      notes: parsed.data.notes || undefined,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "Please fix the errors below.",
        fieldErrors: { name: ["A skill with this name already exists"] },
      };
    }
    throw error;
  }

  revalidatePath("/skills");
  return { status: "success" };
}

export async function deleteSkillAction(id: string): Promise<void> {
  await deleteSkill(id);
  revalidatePath("/skills");
}
