import { NextResponse, type NextRequest } from "next/server";

import { listWorkDays } from "@/lib/data/workday";
import { getWorkingDays } from "@/lib/data/settings";
import { parseDateOnly, parseMonthOnly } from "@/lib/domain/date";
import { getExportFilename } from "@/lib/domain/export";
import { fillMissingWorkingDays, getMonthRange } from "@/lib/domain/workday";
import { buildWorkLogWorkbook } from "@/lib/excel/export";
import { exportQuerySchema } from "@/lib/validation/export";

// Read-only overview-style computation (same reasoning as Dashboard/Calendar/Reports, CLAUDE.md
// §3) — used only to cap how far fillMissingWorkingDays back-fills blank rows, not to record
// anything, so server-UTC "today" being off by a few hours at a timezone boundary is harmless.
function getServerToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Route Handler, not a Server Action (CLAUDE.md §3) — this returns a binary xlsx download, not
// HTML, so it needs the raw Response control a Server Action doesn't give.
export async function GET(request: NextRequest) {
  const query = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = exportQuerySchema.safeParse(query);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid export parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let from: Date;
  let to: Date;
  let filename: string;

  if (parsed.data.type === "day") {
    const date = parseDateOnly(parsed.data.date);
    from = date;
    to = date;
    filename = getExportFilename("day", { date });
  } else if (parsed.data.type === "month") {
    const month = parseMonthOnly(parsed.data.month);
    ({ from, to } = getMonthRange(month));
    filename = getExportFilename("month", { month });
  } else {
    from = parseDateOnly(parsed.data.from);
    to = parseDateOnly(parsed.data.to);
    filename = getExportFilename("range", { from, to });
  }

  const [workDays, workingDays] = await Promise.all([listWorkDays({ from, to }), getWorkingDays()]);
  const filledWorkDays = fillMissingWorkingDays(workDays, { from, to }, workingDays, getServerToday());
  const workbook = await buildWorkLogWorkbook(filledWorkDays);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
