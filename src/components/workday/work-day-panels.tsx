"use client";

import { useState, type ComponentProps } from "react";

import { calculateTotalTaskSeconds } from "@/lib/domain/workday";
import { TimeTrackingCard } from "@/components/workday/time-tracking-card";
import { WorkDayHeader } from "@/components/workday/workday-header";
import { TaskSection } from "@/components/task/task-section";

type DayType = "WORKING" | "HOLIDAY" | "LEAVE";

type Props = {
  workDay: ComponentProps<typeof WorkDayHeader>["workDay"] &
    ComponentProps<typeof TimeTrackingCard>["workDay"] & {
      id: string;
      tasks: ComponentProps<typeof TaskSection>["tasks"];
    };
  dateParam: string;
  netWorkSeconds: number | null;
  availableSkills: ComponentProps<typeof TaskSection>["availableSkills"];
};

// Owns the live `dayType` so choosing Holiday / Leave in the header immediately freezes the
// Time Tracking and Tasks cards — before the Save round-trip, not only after it. The header's
// Save still persists it; when the server sends back a fresh value we re-sync (compare against a
// snapshot in render, same "adjust state during render" pattern used across this app, never an
// effect).
export function WorkDayPanels({ workDay, dateParam, netWorkSeconds, availableSkills }: Props) {
  const [serverDayType, setServerDayType] = useState<DayType>(workDay.dayType);
  const [dayType, setDayType] = useState<DayType>(workDay.dayType);

  if (workDay.dayType !== serverDayType) {
    setServerDayType(workDay.dayType);
    setDayType(workDay.dayType);
  }

  const totalTaskSeconds = calculateTotalTaskSeconds(workDay.tasks);

  return (
    <>
      <WorkDayHeader
        workDay={workDay}
        dateParam={dateParam}
        dayType={dayType}
        onDayTypeChange={setDayType}
      />
      <TimeTrackingCard
        workDay={{ ...workDay, dayType }}
        dateParam={dateParam}
        totalTaskSeconds={totalTaskSeconds}
      />
      <TaskSection
        workDayId={workDay.id}
        dateParam={dateParam}
        tasks={workDay.tasks}
        netWorkSeconds={netWorkSeconds}
        availableSkills={availableSkills}
        dayType={dayType}
      />
    </>
  );
}
