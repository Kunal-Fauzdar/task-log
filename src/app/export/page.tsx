import { FileDown, Info } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ExportQuickLinks } from "@/components/export/export-quick-links";
import { ExportRangeForm } from "@/components/export/export-range-form";

export default function ExportPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={FileDown} title="Export" description="Download your work log as an .xlsx file." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <ExportQuickLinks />
          <ExportRangeForm />
        </div>

        <aside className="border-border bg-card flex h-fit flex-col gap-3 rounded-lg border p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Info className="text-info size-4" />
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
              Working days you configured in Settings but never logged still get a blank row, so
              the file always has one row per expected day.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
