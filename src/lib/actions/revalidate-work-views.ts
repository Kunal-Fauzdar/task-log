import { revalidatePath } from "next/cache";

import { formatDateOnly, parseDateOnly } from "@/lib/domain/date";
import { scheduleSheetSync } from "@/lib/sheets/sync";

// A task or work-day mutation happens on /worklog/[date], but it also changes what the
// read-only overview pages show — the Dashboard's Statistics and Recent Work Days, and the
// Calendar month grid. Those pages have no dynamic inputs of their own, so Next serves them from
// the Full Route Cache (production) and the client-side Router Cache (dev + production) and they
// keep showing a pre-edit snapshot until the cache ages out. Reports only stays current because
// it reads `searchParams` and is therefore always rendered dynamically. Revalidating every
// affected view together here keeps them all in step with the last write, from one place instead
// of a scattered list of revalidatePath calls in every action.
//
// It's also the single hook for the linked Google Sheet: every mutation that touches a day
// re-syncs that day's month tab (after the response is sent — see scheduleSheetSync).
export function revalidateWorkViews(userId: string, date?: string | Date): void {
  const dateParam = date instanceof Date ? formatDateOnly(date) : date;
  if (dateParam) revalidatePath(`/worklog/${dateParam}`);
  revalidatePath("/dashboard");
  revalidatePath("/calendar/[month]", "page");
  revalidatePath("/reports");

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    scheduleSheetSync(userId, [parseDateOnly(dateParam)]);
  }
}
