import { NextResponse, type NextRequest } from "next/server";

import { listWorkDays } from "@/lib/data/workday";
import { parseDateOnly, parseMonthOnly } from "@/lib/domain/date";
import { getExportFilename } from "@/lib/domain/export";
import { getMonthRange } from "@/lib/domain/workday";
import { buildWorkLogWorkbook } from "@/lib/excel/export";
import { exportQuerySchema } from "@/lib/validation/export";

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

  const workDays = await listWorkDays({ from, to });
  const workbook = await buildWorkLogWorkbook(workDays);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
