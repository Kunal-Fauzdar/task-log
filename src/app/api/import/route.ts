import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { listProjects } from "@/lib/data/project";
import { formatDateOnly, parseDateOnly } from "@/lib/domain/date";
import { stripProjectSuffix } from "@/lib/domain/project";
import { parseWorkLogWorkbook } from "@/lib/excel/import";

// Route Handler, not a Server Action (CLAUDE.md §3) — this reads a binary file upload, which a
// Server Action's FormData handling can technically do too, but the project's established split
// keeps all file I/O in Route Handlers and all mutations in Server Actions (see
// src/lib/actions/import-actions.ts for the confirm step). This endpoint never writes to the
// database — it only parses and previews (spec §30: "show an import preview").
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Please upload a .xlsx file." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let preview;
  try {
    preview = await parseWorkLogWorkbook(buffer);
  } catch {
    // Malformed import file (spec §34) — ExcelJS throws when the upload isn't a real xlsx at all.
    return NextResponse.json(
      { error: "This file could not be read. Make sure it's a valid .xlsx WorkLog export." },
      { status: 400 },
    );
  }

  if (!preview.valid) {
    return NextResponse.json({ error: preview.headerError }, { status: 400 });
  }

  const dates = preview.groups.map((group) => parseDateOnly(group.date));
  const [existing, projects] = await Promise.all([
    prisma.workDay.findMany({
      where: { userId: user.id, date: { in: dates } },
      select: { date: true },
    }),
    listProjects(user.id),
  ]);
  const existingDates = new Set(existing.map((workDay) => formatDateOnly(workDay.date)));
  const projectNames = projects.map((p) => p.name);

  // Undo the export's " (Project Name)" Task List suffix so importing an all-projects export
  // back doesn't leave the tag baked into the description.
  const groups = preview.groups.map((group) => ({
    ...group,
    isDuplicate: existingDates.has(group.date),
    tasks: group.tasks.map((task) => ({
      ...task,
      description: stripProjectSuffix(task.description, projectNames),
    })),
  }));

  return NextResponse.json({ groups, rowErrors: preview.rowErrors });
}
