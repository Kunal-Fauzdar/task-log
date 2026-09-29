import { requireUser } from "@/lib/auth/current-user";
import { getWorkingDays } from "@/lib/data/settings";
import { PageHeader } from "@/components/layout/page-header";
import { WorkingDaysForm } from "@/components/settings/working-days-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const workingDays = await getWorkingDays(user.id);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Configure your working days and preferences."
      />
      <WorkingDaysForm workingDays={workingDays} />
    </div>
  );
}
