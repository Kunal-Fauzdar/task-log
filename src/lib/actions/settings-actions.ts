"use server";

import { revalidatePath } from "next/cache";

import { updateWorkingDays } from "@/lib/data/settings";
import { workingDaysSchema } from "@/lib/validation/settings";
import type { ActionState } from "@/lib/actions/types";

export async function updateWorkingDaysAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = workingDaysSchema.safeParse({
    workingDays: formData.getAll("workingDays"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await updateWorkingDays(parsed.data.workingDays);

  // Export reads working days live on every request, so nothing there needs revalidating — only
  // the Settings page itself shows this value.
  revalidatePath("/settings");
  return { status: "success" };
}
