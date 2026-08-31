import { formatSecondsToDuration } from "@/lib/domain/duration";
import type { TasksByTaskId } from "@/lib/domain/reports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TasksByTaskIdTable({ rows }: { rows: TasksByTaskId[] }) {
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
            <TableHead>Task ID</TableHead>
            <TableHead className="w-20">Count</TableHead>
            <TableHead className="w-28">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.taskId}>
              <TableCell className="label-mono">{row.taskId}</TableCell>
              <TableCell className="tabular-nums">{row.count}</TableCell>
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
