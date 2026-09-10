import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { listWorkDays } from "@/lib/data/workday";
import { getProjectById, listProjects } from "@/lib/data/project";
import { getWorkingDays } from "@/lib/data/settings";
import { parseDateOnly, parseMonthOnly } from "@/lib/domain/date";
import { getExportFilename } from "@/lib/domain/export";
import { fillMissingExportDays, getMonthRange } from "@/lib/domain/workday";
import { buildWorkLogWorkbook } from "@/lib/excel/export";
import { exportQuerySchema } from "@/lib/validation/export";

// Read-only overview-style computation (same reasoning as Dashboard/Calendar/Reports, CLAUDE.md
// §3) — used only to cap how far fillMissingExportDays back-fills blank rows, not to record
// anything, so server-UTC "today" being off by a few hours at a timezone boundary is harmless.
function getServerToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

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

  const [workDays, workingDays, projects] = await Promise.all([
    listWorkDays(user.id, { from, to }),
    getWorkingDays(user.id),
    // Only needed for the all-projects export, to tag each task row with its project name.
    project ? Promise.resolve([]) : listProjects(user.id),
  ]);
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  let scopedWorkDays;
  if (project) {
    // A project filter keeps every work day (so its timings still export) but limits each day's
    // task rows to that project — a day with no matching task renders as a timings-only row. No
    // per-row project tag here: the whole file is that one project (and its filename says so).
    scopedWorkDays = workDays.map((workDay) => ({
      ...workDay,
      tasks: workDay.tasks.filter((task) => task.projectId === project.id),
    }));
  } else {
    // All-projects export: append " (Project Name)" to each task's Task List cell.
    scopedWorkDays = workDays.map((workDay) => ({
      ...workDay,
      tasks: workDay.tasks.map((task) => ({
        ...task,
        projectName: task.projectId ? (projectNameById.get(task.projectId) ?? null) : null,
      })),
    }));
  }
  const filledWorkDays = fillMissingExportDays(scopedWorkDays, { from, to }, getServerToday());
  const workbook = await buildWorkLogWorkbook(filledWorkDays, workingDays);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
