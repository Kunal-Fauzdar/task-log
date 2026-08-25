import { ExportQuickLinks } from "@/components/export/export-quick-links";
import { ExportRangeForm } from "@/components/export/export-range-form";

export default function ExportPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Export</h1>
      <ExportQuickLinks />
      <ExportRangeForm />
    </div>
  );
}
