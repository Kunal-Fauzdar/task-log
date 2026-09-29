"use client";

import { useActionState, useState, useTransition } from "react";
import { Clock, FolderKanban, ListChecks, Plus, Search, Trash2 } from "lucide-react";

import { createProjectAction, deleteProjectAction } from "@/lib/actions/project-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { formatDateOnly } from "@/lib/domain/date";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  taskCount: number;
  seconds: number;
  share: number;
  lastWorkedDate: string | null;
};

// Card icon tints cycle through the blue/violet family of the reference.
const TILE_TINTS = [
  "bg-primary/20 text-link",
  "bg-indigo-500/20 text-indigo-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
];

function formatTracked(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatLastWorked(date: string | null): string {
  if (!date) return "Not worked yet";
  const days = Math.round(
    (Date.parse(formatDateOnly(new Date())) - Date.parse(date)) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function AddProjectDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(
    async (prev: typeof IDLE_ACTION_STATE, formData: FormData) => {
      const result = await createProjectAction(prev, formData);
      if (result.status === "success") onClose();
      return result;
    },
    IDLE_ACTION_STATE,
  );
  // Controlled inputs — a validation error must not wipe what was typed (CLAUDE.md §3).
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              aria-invalid={!!state.fieldErrors?.name}
              required
              autoFocus
            />
            {state.fieldErrors?.name && (
              <p role="alert" className="text-destructive text-sm">
                {state.fieldErrors.name[0]}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description">Description (optional)</Label>
            <Input
              id="project-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectManager({ projects }: { projects: ProjectRow[] }) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ProjectRow | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const visible = projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

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
      <PageHeader
        title="Projects"
        description="Organize your work into projects and track tasks, time, and progress."
        actions={
          <>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
                aria-label="Search projects"
                className="w-52 pl-8"
              />
            </div>
            <Button onClick={() => setAdding(true)}>
              <Plus /> Add Project
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2 text-sm">
        <span className="bg-primary/15 text-link rounded-md px-3 py-1.5 font-medium">
          All Projects <span className="ml-1 tabular-nums">{projects.length}</span>
        </span>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((project, i) => (
          <li key={project.id} className="panel group flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${TILE_TINTS[i % TILE_TINTS.length]}`}
              >
                <FolderKanban className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{project.name}</p>
                <p className="text-muted-foreground line-clamp-2 text-xs">
                  {project.description || "No description"}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${project.name}`}
                disabled={isDeleting}
                onClick={() => setPendingDelete(project)}
                className="text-muted-foreground hover:text-destructive rounded-md p-1 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-border h-1.5 flex-1 overflow-hidden rounded-full">
                <div className="bg-primary h-full rounded-full" style={{ width: `${project.share}%` }} />
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">{project.share}%</span>
            </div>
            <div className="text-muted-foreground grid gap-1 text-xs">
              <span className="flex items-center gap-2">
                <ListChecks className="size-3.5" />
                {project.taskCount} {project.taskCount === 1 ? "task" : "tasks"}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="size-3.5" />
                {formatTracked(project.seconds)} tracked
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                Last worked: {formatLastWorked(project.lastWorkedDate)}
              </span>
              <Badge variant="success">Active</Badge>
            </div>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="border-border text-muted-foreground hover:text-foreground hover:border-primary/60 flex h-full min-h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm transition-colors"
          >
            <span className="border-border flex size-9 items-center justify-center rounded-full border">
              <Plus className="size-4" />
            </span>
            Add New Project
            <span className="text-xs">Create a new project to organize your tasks</span>
          </button>
        </li>
      </ul>

      {adding && <AddProjectDialog onClose={() => setAdding(false)} />}

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
