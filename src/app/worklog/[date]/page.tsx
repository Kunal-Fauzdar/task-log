import { notFound } from "next/navigation";

import { findOrCreateWorkDayByDate } from "@/lib/data/workday";
import { listSkills } from "@/lib/data/skill";
import { parseDateOnly } from "@/lib/domain/date";
import { calculateNetWorkSeconds } from "@/lib/domain/workday";
import { BackButton } from "@/components/layout/back-button";
import { WorkDayPanels } from "@/components/workday/work-day-panels";

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function WorkLogDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date: dateParam } = await params;

  if (!DATE_PARAM_PATTERN.test(dateParam)) {
    notFound();
  }

  const date = parseDateOnly(dateParam);
  const [workDay, availableSkills] = await Promise.all([
    findOrCreateWorkDayByDate(date),
    listSkills(),
  ]);
  const netWorkSeconds = calculateNetWorkSeconds(workDay);

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/calendar" />
      <WorkDayPanels
        workDay={workDay}
        dateParam={dateParam}
        netWorkSeconds={netWorkSeconds}
        availableSkills={availableSkills}
      />
    </div>
  );
}
