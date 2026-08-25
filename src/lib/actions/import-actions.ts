"use server";

import { revalidatePath } from "next/cache";

import { importWorkDayGroups, type ImportOutcome } from "@/lib/data/import";
import { importConfirmSchema } from "@/lib/validation/import";

export type ImportActionResult = ImportOutcome | { error: string };

// The Route Handler (/api/import) already parsed and previewed the file — this action only ever
// receives the plain JSON groups the user reviewed and approved in the browser, re-validating
// them from scratch (spec §33: never trust client-side validation alone) before writing
// anything. No file I/O here, so this is a Server Action rather than a Route Handler, per
// CLAUDE.md §3.
export async function importWorkLogAction(groups: unknown): Promise<ImportActionResult> {
  const parsed = importConfirmSchema.safeParse({ groups });
  if (!parsed.success) {
    return { error: "The selected rows are no longer valid — please re-upload the file and try again." };
  }

  const outcome = await importWorkDayGroups(parsed.data.groups);

  revalidatePath("/worklog");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return outcome;
}
