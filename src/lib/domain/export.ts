import { formatDateOnly, formatMonthLabel } from "@/lib/domain/date";

// Collapses a project name to a safe filename fragment: alphanumerics kept, everything else to a
// single "-", trimmed. "Website Redesign" -> "Website-Redesign".
function slugifyProjectName(name: string): string {
  return name
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Filename patterns per spec §28:
//   WorkLog_2026-08-03.xlsx
//   WorkLog_August_2026.xlsx
//   WorkLog_2026-08-01_to_2026-08-31.xlsx
// With a project filter, the project slug is appended: WorkLog_August_2026_Website-Redesign.xlsx
export function getExportFilename(
  kind: "day" | "month" | "range",
  params: { date: Date } | { month: Date } | { from: Date; to: Date },
  projectName?: string,
): string {
  const suffix = projectName ? `_${slugifyProjectName(projectName) || "project"}` : "";

  if (kind === "day" && "date" in params) {
    return `WorkLog_${formatDateOnly(params.date)}${suffix}.xlsx`;
  }
  if (kind === "month" && "month" in params) {
    const label = formatMonthLabel(params.month).replace(" ", "_");
    return `WorkLog_${label}${suffix}.xlsx`;
  }
  if (kind === "range" && "from" in params) {
    return `WorkLog_${formatDateOnly(params.from)}_to_${formatDateOnly(params.to)}${suffix}.xlsx`;
  }
  throw new RangeError(`Mismatched export kind/params: ${kind}`);
}
