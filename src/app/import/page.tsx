import { ImportWizard } from "@/components/import/import-wizard";

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Import</h1>
      <p className="text-sm text-muted-foreground">
        Upload a previously exported WorkLog .xlsx file to bring its data back in. Nothing is
        saved until you review the preview and confirm — existing days are never overwritten.
      </p>
      <ImportWizard />
    </div>
  );
}
