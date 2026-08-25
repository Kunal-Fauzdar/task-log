import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { formatDateOnly, parseDateOnly } from "@/lib/domain/date";
import { parseWorkLogWorkbook } from "@/lib/excel/import";

// Route Handler, not a Server Action (CLAUDE.md §3) — this reads a binary file upload, which a
// Server Action's FormData handling can technically do too, but the project's established split
// keeps all file I/O in Route Handlers and all mutations in Server Actions (see
// src/lib/actions/import-actions.ts for the confirm step). This endpoint never writes to the
// database — it only parses and previews (spec §30: "show an import preview").
export async function POST(request: NextRequest) {
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
  const existing = await prisma.workDay.findMany({
    where: { date: { in: dates } },
    select: { date: true },
  });
  const existingDates = new Set(existing.map((workDay) => formatDateOnly(workDay.date)));

  const groups = preview.groups.map((group) => ({
    ...group,
    isDuplicate: existingDates.has(group.date),
  }));

  return NextResponse.json({ groups, rowErrors: preview.rowErrors });
}
