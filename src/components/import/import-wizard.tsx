"use client";

import { Fragment, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  if (group.isDuplicate) return <Badge variant="secondary">Already exists</Badge>;
  return <Badge variant="outline">New</Badge>;
}

export function ImportWizard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<PreviewGroup[]>([]);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportOutcome | null>(null);

  function reset() {
    setStage("idle");
    setError(null);
    setGroups([]);
    setRowErrors([]);
    setSelected(new Set());
    setResult(null);
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
      <section className="flex flex-col gap-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold tracking-tight">Import complete</h2>
        <ul className="text-sm text-muted-foreground flex flex-col gap-1">
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
          Import another file
        </Button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-file">WorkLog .xlsx file</Label>
          <Input id="import-file" name="file" type="file" accept=".xlsx" ref={fileInputRef} />
        </div>
        <Button type="submit" disabled={stage === "uploading"}>
          {stage === "uploading" ? "Reading file…" : "Upload & Preview"}
        </Button>
      </form>

      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {rowErrors.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{rowErrors.length} row(s) could not be read:</p>
          <ul className="mt-1 list-inside list-disc">
            {rowErrors.map((rowError) => (
              <li key={rowError.rowNumber}>{rowError.message}</li>
            ))}
          </ul>
        </div>
      )}

      {(stage === "preview" || stage === "importing") && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Preview</h2>
          <p className="text-sm text-muted-foreground">
            Existing days are never overwritten — duplicates and invalid rows are unchecked by
            default. Review the selection, then confirm.
          </p>
          <div className="overflow-x-auto rounded-lg border">
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
