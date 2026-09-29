import { requireUser } from "@/lib/auth/current-user";
import { listProjectsWithStats } from "@/lib/data/project";
import { formatDateOnly } from "@/lib/domain/date";
import { ProjectManager } from "@/components/project/project-manager";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listProjectsWithStats(user.id);
  const totalSeconds = projects.reduce(
    (sum, p) => sum + p.tasks.reduce((s, t) => s + t.durationSeconds, 0),
    0,
  );

  return (
    <ProjectManager
      projects={projects.map((project) => {
        const seconds = project.tasks.reduce((s, t) => s + t.durationSeconds, 0);
        const lastWorked = project.tasks.reduce<Date | null>(
          (latest, t) => (!latest || t.workDay.date > latest ? t.workDay.date : latest),
          null,
        );
        return {
          id: project.id,
          name: project.name,
          description: project.description,
          taskCount: project.tasks.length,
          seconds,
          share: totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0,
          lastWorkedDate: lastWorked ? formatDateOnly(lastWorked) : null,
        };
      })}
    />
  );
}
