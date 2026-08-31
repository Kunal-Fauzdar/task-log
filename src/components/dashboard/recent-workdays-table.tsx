import Link from "next/link";

import { formatDateOnly, getDayName } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import {
  WORK_DAY_STATUS_BADGE_VARIANT,
  WORK_DAY_STATUS_LABELS,
  calculateNetWorkSeconds,
} from "@/lib/domain/workday";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RecentWorkDay = {
  id: string;
  date: Date;
  status: keyof typeof WORK_DAY_STATUS_LABELS;
  checkIn: Date | null;
  checkOut: Date | null;
  breakSeconds: number;
  tasks: { durationSeconds: number }[];
};

export function RecentWorkDaysTable({ workDays }: { workDays: RecentWorkDay[] }) {
  if (workDays.length === 0) {
    return (
      <p className="text-muted-foreground bg-card rounded-lg border border-border border-dashed p-6 text-center text-sm">
        No work logged yet.
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
            <TableHead>Status</TableHead>
            <TableHead className="w-28">Net Duration</TableHead>
            <TableHead className="w-20">Tasks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workDays.map((workDay) => {
            const netWorkSeconds = calculateNetWorkSeconds(workDay);
            return (
              <TableRow key={workDay.id}>
                <TableCell>
                  <Link
                    href={`/worklog/${formatDateOnly(workDay.date)}`}
                    className="text-link underline underline-offset-4"
                  >
                    {formatDateOnly(workDay.date)}
                  </Link>
                </TableCell>
                <TableCell>{getDayName(workDay.date)}</TableCell>
                <TableCell>
                  <Badge variant={WORK_DAY_STATUS_BADGE_VARIANT[workDay.status]}>
                    {WORK_DAY_STATUS_LABELS[workDay.status]}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {netWorkSeconds !== null
                    ? formatSecondsToDuration(Math.max(0, netWorkSeconds))
                    : "—"}
                </TableCell>
                <TableCell className="tabular-nums">{workDay.tasks.length}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
