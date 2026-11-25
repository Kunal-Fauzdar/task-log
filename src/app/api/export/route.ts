import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { loadExportData } from "@/lib/data/export-data";
import { getProjectById } from "@/lib/data/project";
import { parseDateOnly, parseMonthOnly } from "@/lib/domain/date";
import { getExportFilename } from "@/lib/domain/export";
import { getMonthRange } from "@/lib/domain/workday";
import { buildWorkLogWorkbook } from "@/lib/excel/export";
import { exportQuerySchema } from "@/lib/validation/export";

// Route Handler, not a Server Action (CLAUDE.md §3) — this returns a binary xlsx download, not
// HTML, so it needs the raw Response control a Server Action doesn't give.
export async function GET(request: NextRequest) {
  // src/proxy.ts already blocks unauthenticated requests with a 401; this also gives us the
  // owner id to scope every query below.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = exportQuerySchema.safeParse(query);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid export parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Optional per-project timesheet filter. An unknown id (or another user's) → 404 rather than
  // silently exporting everything (a stale bookmark shouldn't look like it worked).
  const project = parsed.data.projectId
    ? await getProjectById(user.id, parsed.data.projectId)
    : null;
  if (parsed.data.projectId && !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const projectName = project?.name;

  let from: Date;
  let to: Date;
  let filename: string;

  if (parsed.data.type === "day") {
    const date = parseDateOnly(parsed.data.date);
    from = date;
    to = date;
    filename = getExportFilename("day", { date }, projectName);
  } else if (parsed.data.type === "month") {
    const month = parseMonthOnly(parsed.data.month);
    ({ from, to } = getMonthRange(month));
    filename = getExportFilename("month", { month }, projectName);
  } else {
    from = parseDateOnly(parsed.data.from);
    to = parseDateOnly(parsed.data.to);
    filename = getExportFilename("range", { from, to }, projectName);
  }

  // Shared with the Google Sheets sync (src/lib/sheets/sync.ts) so both produce identical rows.
  const { workDays, workingDays } = await loadExportData(user.id, { from, to }, project);
  const workbook = await buildWorkLogWorkbook(workDays, workingDays);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
