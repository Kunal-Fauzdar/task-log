import { formatDateOnly, getDayName } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import type { TasksByDate } from "@/lib/domain/reports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TasksByDateTable({ rows }: { rows: TasksByDate[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground bg-card rounded-lg border border-border border-dashed p-6 text-center text-sm">
        No tasks in this range.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Day</TableHead>
            <TableHead className="w-20">Tasks</TableHead>
            <TableHead className="w-28">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={formatDateOnly(row.date)}>
              <TableCell>{formatDateOnly(row.date)}</TableCell>
              <TableCell>{getDayName(row.date)}</TableCell>
              <TableCell className="tabular-nums">{row.taskCount}</TableCell>
              <TableCell className="tabular-nums">
                {formatSecondsToDuration(row.totalDurationSeconds)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
