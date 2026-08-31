"use client";

import { Fragment, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, File, FileUp, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { importWorkLogAction, type ImportActionResult } from "@/lib/actions/import-actions";
import type { ImportOutcome } from "@/lib/data/import";
import type { ImportGroup, ImportRowError } from "@/lib/excel/import";

type PreviewGroup = ImportGroup & { isDuplicate: boolean };

type Stage = "idle" | "uploading" | "preview" | "importing" | "done";

function groupTotalSeconds(group: PreviewGroup): number {
  return group.tasks.reduce((sum, task) => sum + task.durationSeconds, 0);
}

function statusBadge(group: PreviewGroup) {
  if (group.errors.length > 0) return <Badge variant="destructive">Invalid</Badge>;
  if (group.isDuplicate) return <Badge variant="warning">Already exists</Badge>;
  return <Badge variant="success">New</Badge>;
}

export function ImportWizard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<PreviewGroup[]>([]);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportOutcome | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function reset() {
    setStage("idle");
    setError(null);
    setGroups([]);
    setRowErrors([]);
    setSelected(new Set());
    setResult(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .xlsx file first.");
      return;
    }

    setStage("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/import", { method: "POST", body: formData });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "This file could not be imported.");
      setStage("idle");
      return;
    }

    const importedGroups = data.groups as PreviewGroup[];
    setGroups(importedGroups);
    setRowErrors(data.rowErrors ?? []);
    setSelected(
      new Set(
        importedGroups
          .map((group, index) => ({ group, index }))
          .filter(({ group }) => group.errors.length === 0 && !group.isDuplicate)
          .map(({ index }) => index),
      ),
    );
    setStage("preview");
  }

  function toggleSelected(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleConfirm() {
    setStage("importing");
    setError(null);

    const selectedGroups = groups.filter((_, index) => selected.has(index));
    const outcome: ImportActionResult = await importWorkLogAction(selectedGroups);

    if ("error" in outcome) {
      setError(outcome.error);
      setStage("preview");
      return;
    }

    setResult(outcome);
    setStage("done");
  }

  if (stage === "done" && result) {
    return (
      <section className="border-success/30 bg-success/5 flex flex-col gap-4 rounded-lg border p-6 shadow-sm">
        <h2 className="text-success flex items-center gap-2 text-lg font-semibold tracking-tight">
          <CheckCircle2 className="size-5" />
          Import complete
        </h2>
        <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
          <li>{result.importedCount} day(s) imported.</li>
          {result.skippedDuplicates.length > 0 && (
            <li>
              {result.skippedDuplicates.length} day(s) already existed and were skipped:{" "}
              {result.skippedDuplicates.join(", ")}.
            </li>
          )}
          {result.failed.length > 0 && (
            <li>
              {result.failed.length} day(s) failed to import:{" "}
              {result.failed.map((f) => f.date).join(", ")}.
            </li>
          )}
        </ul>
        <Button onClick={reset} className="w-fit">
          <FileUp /> Import another file
        </Button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleUpload}
        className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-sm"
      >
        <label
          htmlFor="import-file"
          className="border-border hover:border-primary/50 hover:bg-accent/40 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors"
        >
          <span className="bg-primary/10 text-link flex size-10 items-center justify-center rounded-full">
            <File className="size-5" />
          </span>
          {fileName ? (
            <span className="text-sm font-medium">{fileName}</span>
          ) : (
            <>
              <span className="text-sm font-medium">Choose a WorkLog .xlsx file</span>
              <span className="text-muted-foreground text-xs">or drag and drop it here</span>
            </>
          )}
          <input
            id="import-file"
            name="file"
            type="file"
            accept=".xlsx"
            ref={fileInputRef}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="sr-only"
          />
        </label>
        <Button type="submit" disabled={stage === "uploading"} className="self-start">
          <Upload /> {stage === "uploading" ? "Reading file…" : "Upload & Preview"}
        </Button>
      </form>

      {error && (
        <p className="border-destructive/50 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {rowErrors.length > 0 && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" />
            {rowErrors.length} row(s) could not be read:
          </p>
          <ul className="mt-1 list-inside list-disc">
            {rowErrors.map((rowError) => (
              <li key={rowError.rowNumber}>{rowError.message}</li>
            ))}
          </ul>
        </div>
      )}

      {(stage === "preview" || stage === "importing") && (
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <FileUp className="text-accent size-5" />
            Preview
          </h2>
          <p className="text-sm text-muted-foreground">
            Existing days are never overwritten — duplicates and invalid rows are unchecked by
            default. Review the selection, then confirm.
          </p>
          <div className="overflow-x-auto rounded-lg border bg-card/85 shadow-sm backdrop-blur-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Tasks</TableHead>
                  <TableHead className="w-28">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group, index) => {
                  const disabled = group.errors.length > 0 || group.isDuplicate;
                  return (
                    <Fragment key={group.date}>
                      <TableRow>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(index)}
                            disabled={disabled}
                            onCheckedChange={() => toggleSelected(index)}
                            aria-label={`Import ${group.date}`}
                          />
                        </TableCell>
                        <TableCell>
                          {group.date} ({group.day})
                        </TableCell>
                        <TableCell>{statusBadge(group)}</TableCell>
                        <TableCell className="tabular-nums">{group.tasks.length}</TableCell>
                        <TableCell className="tabular-nums">
                          {group.isHoliday
                            ? "Holiday"
                            : formatSecondsToDuration(groupTotalSeconds(group))}
                        </TableCell>
                      </TableRow>
                      {group.errors.length > 0 && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={4} className="text-destructive text-xs">
                            {group.errors.join(" · ")}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0 || stage === "importing"}
            className="w-fit"
          >
            {stage === "importing" ? "Importing…" : `Confirm Import (${selected.size})`}
          </Button>
        </section>
      )}
    </div>
  );
}
