"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FolderPlus, Trash2 } from "lucide-react";

import { createProjectAction, deleteProjectAction } from "@/lib/actions/project-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProjectRow = { id: string; name: string; taskCount: number };

export function ProjectManager({ projects }: { projects: ProjectRow[] }) {
  const [state, formAction, isPending] = useActionState(createProjectAction, IDLE_ACTION_STATE);
  // Controlled, not defaultValue — a validation-error return would otherwise wipe the field
  // (CLAUDE.md §3, same as every other useActionState form here).
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ProjectRow | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear the field after a successful add — "adjust state during render" against a snapshot of
  // the action state, not useEffect + setState (react-hooks/set-state-in-effect, CLAUDE.md §3).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "success") setName("");
  }

  // Refocus is a DOM side effect (no setState), so an effect is the right tool here.
  useEffect(() => {
    if (state.status === "success") inputRef.current?.focus();
  }, [state]);

  function confirmDelete() {
    const project = pendingDelete;
    if (!project) return;
    setPendingDelete(null);
    startDelete(async () => {
      await deleteProjectAction(project.id);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="bg-secondary flex flex-col gap-3 rounded-lg p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <FolderPlus className="text-link size-5" />
          Add a project
        </h2>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              name="name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              aria-invalid={!!state.fieldErrors?.name}
              required
            />
          </div>
          <Button type="submit" disabled={isPending}>
            <FolderPlus className="size-4" /> {isPending ? "Adding…" : "Add Project"}
          </Button>
        </form>
        {state.fieldErrors?.name && (
          <p role="alert" className="text-destructive text-sm">
            {state.fieldErrors.name[0]}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-semibold tracking-tight">
          Your projects{" "}
          <span className="text-muted-foreground text-sm font-normal">({projects.length})</span>
        </h2>

        {projects.length === 0 ? (
          <p className="text-muted-foreground bg-secondary/50 rounded-lg p-6 text-center text-sm">
            No projects yet. Add one above, then pick it when logging a task.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((project) => (
              <li
                key={project.id}
                className="border-border bg-card flex items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {project.taskCount} {project.taskCount === 1 ? "task" : "tasks"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={isDeleting}
                  onClick={() => setPendingDelete(project)}
                >
                  <Trash2 className="size-4" /> Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.taskCount > 0
                ? `Its ${pendingDelete.taskCount} ${
                    pendingDelete.taskCount === 1 ? "task" : "tasks"
                  } will stay in their work days, moved back to “No project”.`
                : "This project has no tasks."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
