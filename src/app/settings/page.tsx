import { Settings as SettingsIcon } from "lucide-react";

import { getWorkingDays } from "@/lib/data/settings";
import { PageHeader } from "@/components/layout/page-header";
import { WorkingDaysForm } from "@/components/settings/working-days-form";

export default async function SettingsPage() {
  const workingDays = await getWorkingDays();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={SettingsIcon} title="Settings" />
      <WorkingDaysForm workingDays={workingDays} />
    </div>
  );
}
