import { formatDateOnly, formatMonthLabel } from "@/lib/domain/date";

// Filename patterns per spec §28:
//   WorkLog_2026-08-03.xlsx
//   WorkLog_August_2026.xlsx
//   WorkLog_2026-08-01_to_2026-08-31.xlsx
export function getExportFilename(
  kind: "day" | "month" | "range",
  params: { date: Date } | { month: Date } | { from: Date; to: Date },
): string {
  if (kind === "day" && "date" in params) {
    return `WorkLog_${formatDateOnly(params.date)}.xlsx`;
  }
  if (kind === "month" && "month" in params) {
    const label = formatMonthLabel(params.month).replace(" ", "_");
    return `WorkLog_${label}.xlsx`;
  }
  if (kind === "range" && "from" in params) {
    return `WorkLog_${formatDateOnly(params.from)}_to_${formatDateOnly(params.to)}.xlsx`;
  }
  throw new RangeError(`Mismatched export kind/params: ${kind}`);
}
