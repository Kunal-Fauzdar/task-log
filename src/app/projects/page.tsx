import { FolderKanban } from "lucide-react";

import { listProjectsWithTaskCounts } from "@/lib/data/project";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectManager } from "@/components/project/project-manager";

export default async function ProjectsPage() {
  const projects = await listProjectsWithTaskCounts();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={FolderKanban}
        eyebrow="Timesheets"
        title="Projects"
        description="Group tasks under a project, then export a per-project timesheet. Removing a project keeps its tasks — they just move back to “No project”."
      />
      <ProjectManager
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          taskCount: project._count.tasks,
        }))}
      />
    </div>
  );
}
