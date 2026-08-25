import { listWorkDays } from "@/lib/data/workday";
import { getTasksInRange } from "@/lib/data/reports";
import { formatDateOnly, parseDateOnly } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { getMonthRange } from "@/lib/domain/workday";
import {
  buildMonthlySummary,
  buildWorkSummary,
  groupTasksByDate,
  groupTasksBySkill,
  groupTasksByTaskId,
} from "@/lib/domain/reports";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ReportDateFilterForm } from "@/components/reports/report-date-filter-form";
import { TasksByDateTable } from "@/components/reports/tasks-by-date-table";
import { TasksByTaskIdTable } from "@/components/reports/tasks-by-taskid-table";
import { SkillUsageTable } from "@/components/reports/skill-usage-table";
import { MonthlySummaryTable } from "@/components/reports/monthly-summary-table";

// Reports is a read-only overview, like Dashboard/Calendar (CLAUDE.md §3) — "today" is computed
// server-side rather than fetched client-side, since being off by a few hours at a timezone
// boundary only affects the default filter range, not a mutation.
function getServerToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Falls back to the current month whenever `from`/`to` are missing, malformed, or inverted,
// rather than 404ing — this is an optional filter on a read-only page (spec §31: "Reports
// should support date filtering"), not a route param identifying one specific resource (contrast
// /calendar/[month], which does 404 on a bad month segment).
function resolveRange(searchParams: { from?: string; to?: string }): { from: Date; to: Date } {
  try {
    if (searchParams.from && searchParams.to) {
      const from = parseDateOnly(searchParams.from);
      const to = parseDateOnly(searchParams.to);
      if (to.getTime() >= from.getTime()) return { from, to };
    }
  } catch {
    // Malformed date string — fall through to the default range below.
  }
  return getMonthRange(getServerToday());
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveRange(params);

  const [workDays, tasks] = await Promise.all([
    listWorkDays(range),
    getTasksInRange(range),
  ]);

  const workSummary = buildWorkSummary(workDays, tasks);
  const tasksByDate = groupTasksByDate(tasks);
  const tasksByTaskId = groupTasksByTaskId(tasks);
  const skillUsage = groupTasksBySkill(tasks);
  const monthlySummary = buildMonthlySummary(workDays, tasks);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Reports</h1>

      <ReportDateFilterForm from={formatDateOnly(range.from)} to={formatDateOnly(range.to)} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Work Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total working days" value={String(workSummary.totalWorkingDays)} />
          <StatTile label="Total hours" value={formatSecondsToDuration(workSummary.totalHoursSeconds)} />
          <StatTile
            label="Avg. daily hours"
            value={formatSecondsToDuration(workSummary.averageDailyHoursSeconds)}
          />
          <StatTile
            label="Total task duration"
            value={formatSecondsToDuration(workSummary.totalTaskDurationSeconds)}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Task Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Number of tasks" value={String(tasks.length)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Tasks by Date</h3>
            <TasksByDateTable rows={tasksByDate} />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Tasks by Task ID</h3>
            <TasksByTaskIdTable rows={tasksByTaskId} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Skill Usage</h2>
        <SkillUsageTable rows={skillUsage} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Monthly Summary</h2>
        <MonthlySummaryTable rows={monthlySummary} />
      </section>
    </div>
  );
}
