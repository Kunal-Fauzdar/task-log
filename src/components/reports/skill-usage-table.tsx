import { formatSecondsToDuration } from "@/lib/domain/duration";
import type { SkillUsage } from "@/lib/domain/reports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SkillUsageTable({ rows }: { rows: SkillUsage[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground bg-secondary/50 rounded-lg p-6 text-center text-sm">
        No skill-tagged tasks in this range.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Skill</TableHead>
            <TableHead className="w-20">Tasks</TableHead>
            <TableHead className="w-28">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.skillId}>
              <TableCell>{row.skillName}</TableCell>
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
