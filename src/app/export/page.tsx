import { FileDown, Info } from "lucide-react";

import { listProjects } from "@/lib/data/project";
import { PageHeader } from "@/components/layout/page-header";
import { ExportQuickLinks } from "@/components/export/export-quick-links";
import { ExportRangeForm } from "@/components/export/export-range-form";

export default async function ExportPage() {
  const projects = await listProjects();
  const projectOptions = projects.map((project) => ({ id: project.id, name: project.name }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={FileDown}
        eyebrow="Spreadsheet"
        title="Export"
        description="Download a day, a month, or a custom range as a formatted .xlsx file."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <ExportQuickLinks projects={projectOptions} />
          <ExportRangeForm projects={projectOptions} />
        </div>

        <aside className="bg-muted flex h-fit flex-col gap-3 rounded-lg p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Info className="text-link size-4" />
            What&apos;s in the file
          </h2>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
            <li>
              One row per task, with Date/Day/Check In/Check Out/Break merged across a day&apos;s
              rows.
            </li>
            <li>Task links export as real, clickable Excel hyperlinks — not plain text.</li>
            <li>Holiday days get a single row marked accordingly.</li>
            <li>
              Pick a project to get its own timesheet — same layout, only that project&apos;s
              tasks. Days with none still show their check-in/out and break.
            </li>
            <li>
              Working days you configured in Settings but never logged still get a blank row, so
              the file always has one row per expected day.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
