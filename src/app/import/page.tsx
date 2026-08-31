import { FileUp, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ImportWizard } from "@/components/import/import-wizard";

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={FileUp}
        eyebrow="Spreadsheet"
        title="Import"
        description="Bring a previously exported WorkLog .xlsx file back in. Existing days are never overwritten."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ImportWizard />

        <aside className="border-border bg-card flex h-fit flex-col gap-3 rounded-lg border p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <ShieldCheck className="text-link size-4" />
            How it works
          </h2>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
            <li>Existing days are never overwritten — a duplicate date is unchecked by default.</li>
            <li>Each row is validated independently; one bad row won&apos;t block the rest.</li>
            <li>You review and confirm the exact set of days before anything is saved.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
