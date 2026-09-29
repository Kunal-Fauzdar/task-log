import Link from "next/link";
import { Briefcase, Clock, ClipboardList, ListChecks } from "lucide-react";

import { requireUser } from "@/lib/auth/current-user";
import { listWorkDays } from "@/lib/data/workday";
import { getTasksInRange } from "@/lib/data/reports";
import { formatDateOnly, parseDateOnly } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { getMonthRange, sumNetWorkSeconds } from "@/lib/domain/workday";
import {
  buildMonthlySummary,
  buildWorkSummary,
  groupTasksByDate,
  groupTasksBySkill,
  groupTasksByTaskId,
} from "@/lib/domain/reports";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { PageHeader } from "@/components/layout/page-header";
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

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "work", label: "Work" },
  { id: "tasks", label: "Tasks" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
] as const;

const DONUT_COLORS = ["#2f6bff", "#6f9bff", "#8b5cf6", "#22a6c9", "#5b6b99", "#a5b4fc"];
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const range = resolveRange(params);
  const tab = TABS.some((t) => t.id === params.tab) ? params.tab! : "overview";
  const fromParam = formatDateOnly(range.from);
  const toParam = formatDateOnly(range.to);

  const [workDays, tasks] = await Promise.all([
    listWorkDays(user.id, range),
    getTasksInRange(user.id, range),
  ]);

  const workSummary = buildWorkSummary(workDays, tasks);
  const tasksByDate = groupTasksByDate(tasks);
  const tasksByTaskId = groupTasksByTaskId(tasks);
  const skillUsage = groupTasksBySkill(tasks);
  const monthlySummary = buildMonthlySummary(workDays, tasks);

  // Daily net hours across the range (one bar per calendar day).
  const dayCount = Math.min(
    120,
    Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1,
  );
  const hoursByDay = Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(range.from);
    date.setUTCDate(range.from.getUTCDate() + i);
    const key = formatDateOnly(date);
    const day = workDays.find((d) => formatDateOnly(d.date) === key);
    return { label: String(date.getUTCDate()), value: day ? sumNetWorkSeconds([day]) / 3600 : 0 };
  });

  const projectCounts = new Map<string, number>();
  const projectTime = new Map<string, number>();
  for (const task of tasks) {
    const name = task.project?.name ?? "No project";
    projectCounts.set(name, (projectCounts.get(name) ?? 0) + 1);
    projectTime.set(name, (projectTime.get(name) ?? 0) + task.durationSeconds);
  }
  const projectSlices = [...projectCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: DONUT_COLORS[i % DONUT_COLORS.length] }));

  const tabHref = (id: string) => `/reports?from=${fromParam}&to=${toParam}&tab=${id}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reports"
        description="Work, task, and skill totals for a date range. Defaults to the current month."
        actions={<ReportDateFilterForm from={fromParam} to={toParam} tab={tab} />}
      />

      <nav
        aria-label="Report sections"
        className="border-border flex w-fit gap-1 rounded-lg border p-1"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            aria-current={t.id === tab ? "page" : undefined}
            className={
              t.id === tab
                ? "bg-primary/15 text-link rounded-md px-3.5 py-1.5 text-sm font-medium"
                : "text-muted-foreground hover:text-foreground rounded-md px-3.5 py-1.5 text-sm"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Working Days"
          value={String(workSummary.totalWorkingDays)}
          icon={Briefcase}
          accent="info"
        />
        <StatTile
          label="Total Hours"
          value={formatSecondsToDuration(workSummary.totalHoursSeconds)}
          icon={Clock}
        />
        <StatTile
          label="Task Duration"
          value={formatSecondsToDuration(workSummary.totalTaskDurationSeconds)}
          icon={ClipboardList}
          accent="info"
        />
        <StatTile label="Total Tasks" value={String(tasks.length)} icon={ListChecks} />
      </div>

      {tab === "overview" && (
        <>
          <section className="panel flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Work Hours</h2>
              <span className="text-muted-foreground text-xs">Hours</span>
            </div>
            <BarChart data={hoursByDay} />
          </section>
          <div className="grid gap-4">
            <section className="panel flex flex-col gap-3 p-5">
              <h2 className="text-sm font-semibold">Tasks by Project</h2>
              {projectSlices.length === 0 ? (
                <p className="text-muted-foreground text-sm">No tasks in this range.</p>
              ) : (
                <DonutChart
                  slices={projectSlices}
                  centerValue={String(tasks.length)}
                  centerLabel="Tasks"
                />
              )}
            </section>
          </div>
        </>
      )}

      {tab === "work" && (
        <>
          <section className="flex flex-col gap-2.5">
            <h2 className="text-sm font-semibold">Tasks by Date</h2>
            <TasksByDateTable rows={tasksByDate} />
          </section>
          <section className="flex flex-col gap-2.5">
            <h2 className="text-sm font-semibold">Monthly Summary</h2>
            <MonthlySummaryTable rows={monthlySummary} />
          </section>
        </>
      )}

      {tab === "tasks" && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-sm font-semibold">Tasks by Task ID</h2>
          <TasksByTaskIdTable rows={tasksByTaskId} />
        </section>
      )}

      {tab === "projects" && (
        <section className="panel flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">Time by Project</h2>
          {projectTime.size === 0 ? (
            <p className="text-muted-foreground text-sm">No tasks in this range.</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {[...projectTime.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, seconds]) => (
                  <li key={name} className="flex items-center justify-between py-2">
                    <span>{name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {projectCounts.get(name)} tasks · {formatSecondsToDuration(seconds)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {tab === "skills" && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-sm font-semibold">Skill Usage</h2>
          <SkillUsageTable rows={skillUsage} />
        </section>
      )}
    </div>
  );
}
