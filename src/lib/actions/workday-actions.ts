"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { workDayEditSchema, workDayTimesSchema } from "@/lib/validation/workday";
import {
  deleteWorkDay,
  endBreak,
  endWork,
  startBreak,
  startWork,
  updateWorkDay,
  updateWorkDayTimes,
} from "@/lib/data/workday";
import { combineDateAndTime, parseDateOnly } from "@/lib/domain/date";
import type { ActionState } from "@/lib/actions/types";

export async function updateWorkDayAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");

  const parsed = workDayEditSchema.safeParse({
    // `?? undefined` matters here, not just style: FormData.get() returns null (not undefined)
    // for a missing key, and holidayReason's input only exists in the DOM while "Mark as
    // holiday" is on — so unmarking a holiday and saving always submitted holidayReason as
    // null. Zod's z.string().optional() accepts undefined but rejects null outright, so every
    // "remove holiday" save failed validation before reaching updateWorkDay at all (found via
    // manual QA in Phase 11 — the switch appeared to silently revert after clicking Save).
    notes: formData.get("notes") ?? undefined,
    isHoliday: formData.get("isHoliday") === "on",
    holidayReason: formData.get("holidayReason") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await updateWorkDay(id, {
    notes: parsed.data.notes || undefined,
    isHoliday: parsed.data.isHoliday,
    holidayReason: parsed.data.isHoliday ? parsed.data.holidayReason || undefined : null,
  });

  revalidatePath(`/worklog/${date}`);
  return { status: "success" };
}

// Redirects rather than returning ActionState — unlike every other WorkDay mutation, this one
// removes the record the current /worklog/[date] page is showing, so there's nothing left to
// revalidate in place. Lands on /dashboard, the app's home, same as logoutAction.
export async function deleteWorkDayAction(id: string): Promise<void> {
  await deleteWorkDay(id);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// checkInAtIso/checkOutAtIso must be the ISO string of a naive-local-encoded Date captured
// client-side (see src/lib/domain/date.ts getNaiveLocalNow) — never computed here, or "now"
// would be the server's timezone instead of the user's.
export async function startWorkAction(
  workDayId: string,
  date: string,
  checkInAtIso: string,
): Promise<void> {
  await startWork(workDayId, new Date(checkInAtIso));
  revalidatePath(`/worklog/${date}`);
}

export async function endWorkAction(
  workDayId: string,
  date: string,
  checkOutAtIso: string,
): Promise<void> {
  await endWork(workDayId, new Date(checkOutAtIso));
  revalidatePath(`/worklog/${date}`);
}

export async function startBreakAction(workDayId: string, date: string): Promise<void> {
  await startBreak(workDayId);
  revalidatePath(`/worklog/${date}`);
}

export async function endBreakAction(workDayId: string, date: string): Promise<void> {
  await endBreak(workDayId);
  revalidatePath(`/worklog/${date}`);
}

export async function updateWorkDayTimesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");

  const parsed = workDayTimesSchema.safeParse({
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    breakDuration: formData.get("breakDuration"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const dayDate = parseDateOnly(date);
  await updateWorkDayTimes(id, {
    checkIn: parsed.data.checkIn ? combineDateAndTime(dayDate, parsed.data.checkIn) : null,
    checkOut: parsed.data.checkOut ? combineDateAndTime(dayDate, parsed.data.checkOut) : null,
    breakSeconds: parsed.data.breakDuration,
  });

  revalidatePath(`/worklog/${date}`);
  return { status: "success" };
}
