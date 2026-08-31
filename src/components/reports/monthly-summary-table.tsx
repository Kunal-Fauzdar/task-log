import { formatMonthLabel, parseMonthOnly } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import type { MonthlySummary } from "@/lib/domain/reports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function MonthlySummaryTable({ rows }: { rows: MonthlySummary[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground bg-card/40 backdrop-blur-md rounded-lg border border-dashed p-5 text-center text-sm">
        No activity in this range.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card/85 shadow-sm backdrop-blur-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead className="w-28">Total Hours</TableHead>
            <TableHead className="w-20">Tasks</TableHead>
            <TableHead className="w-28">Task Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.month}>
              <TableCell>{formatMonthLabel(parseMonthOnly(row.month))}</TableCell>
              <TableCell className="tabular-nums">
                {formatSecondsToDuration(row.totalHoursSeconds)}
              </TableCell>
              <TableCell className="tabular-nums">{row.taskCount}</TableCell>
              <TableCell className="tabular-nums">
                {formatSecondsToDuration(row.totalTaskDurationSeconds)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
