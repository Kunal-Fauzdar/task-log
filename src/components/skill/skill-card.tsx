"use client";

import { useState } from "react";
import { History, Pencil, Trash2 } from "lucide-react";

import { formatDateOnly } from "@/lib/domain/date";
import {
  SKILL_CATEGORY_BORDER_CLASS,
  SKILL_CATEGORY_PROGRESS_CLASS,
  formatProficiencyChange,
} from "@/lib/domain/skill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SkillRecord } from "@/components/skill/skill-form-dialog";
import { cn } from "@/lib/utils";

export type SkillCardData = SkillRecord & {
  category: string;
  updatedAt: Date;
  history: { id: string; fromPercentage: number; toPercentage: number; changedAt: Date }[];
};

export function SkillCard({
  skill,
  onEdit,
  onDelete,
}: {
  skill: SkillCardData;
  onEdit: (skill: SkillCardData) => void;
  onDelete: (skill: SkillCardData) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const category = skill.category as keyof typeof SKILL_CATEGORY_PROGRESS_CLASS;
  const progressClass = SKILL_CATEGORY_PROGRESS_CLASS[category];
  const borderClass = SKILL_CATEGORY_BORDER_CLASS[category];

  return (
    <div
      className={cn(
        "border-border bg-card hover:border-accent flex flex-col gap-2 rounded-lg border border-l-2 p-4 transition-colors",
        borderClass,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium">{skill.name}</h3>
        <span className="text-sm font-semibold tabular-nums">{skill.proficiencyPercentage}%</span>
      </div>

      <Progress
        value={skill.proficiencyPercentage}
        indicatorClassName={progressClass}
        aria-label={`${skill.name} proficiency`}
      />

      <p className="text-muted-foreground text-xs">
        Updated {formatDateOnly(skill.updatedAt)}
      </p>

      {skill.notes && <p className="text-sm">{skill.notes}</p>}

      {skill.history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs underline underline-offset-4"
          >
            <History className="size-3" />
            {showHistory ? "Hide" : "Show"} history ({skill.history.length})
          </button>
          {showHistory && (
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {skill.history.map((entry) => (
                <li key={entry.id} className="text-muted-foreground">
                  {formatProficiencyChange(entry.fromPercentage, entry.toPercentage)} ·{" "}
                  {formatDateOnly(entry.changedAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={cn("flex justify-end gap-1", !skill.history.length && "mt-1")}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${skill.name}`}
          onClick={() => onEdit(skill)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${skill.name}`}
          onClick={() => onDelete(skill)}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
