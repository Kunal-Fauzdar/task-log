import { requireUser } from "@/lib/auth/current-user";
import { listProjects } from "@/lib/data/project";
import { PageHeader } from "@/components/layout/page-header";
import { ExportPanel } from "@/components/export/export-panel";

export default async function ExportPage() {
  const user = await requireUser();
  const projects = await listProjects(user.id);
  const projectOptions = projects.map((project) => ({ id: project.id, name: project.name }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Export" description="Download your data in various formats." />
      <ExportPanel projects={projectOptions} />
    </div>
  );
}
