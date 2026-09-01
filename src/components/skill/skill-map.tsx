"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";

import { deleteSkillAction } from "@/lib/actions/skill-actions";
import { SKILL_CATEGORY_LABELS, SKILL_CATEGORY_ORDER } from "@/lib/domain/skill";
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
import { SkillCard, type SkillCardData } from "@/components/skill/skill-card";
import { SkillFormDialog } from "@/components/skill/skill-form-dialog";

type CategoryFilter = "ALL" | (typeof SKILL_CATEGORY_ORDER)[number];

export function SkillMap({ skills }: { skills: SkillCardData[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [dialogSkill, setDialogSkill] = useState<SkillCardData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [skillPendingDelete, setSkillPendingDelete] = useState<SkillCardData | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return skills.filter(
      (skill) =>
        (categoryFilter === "ALL" || skill.category === categoryFilter) &&
        (query === "" || skill.name.toLowerCase().includes(query)),
    );
  }, [skills, search, categoryFilter]);

  const groups = SKILL_CATEGORY_ORDER.map((category) => ({
    category,
    skills: filtered.filter((skill) => skill.category === category),
  }));

  function confirmDelete() {
    const skill = skillPendingDelete;
    if (!skill) return;
    setSkillPendingDelete(null);
    startTransition(async () => {
      await deleteSkillAction(skill.id);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search skills…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 pl-8"
              aria-label="Search skills"
            />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by category">
            <Button
              type="button"
              size="sm"
              variant={categoryFilter === "ALL" ? "secondary" : "ghost"}
              onClick={() => setCategoryFilter("ALL")}
            >
              All
            </Button>
            {SKILL_CATEGORY_ORDER.map((category) => (
              <Button
                key={category}
                type="button"
                size="sm"
                variant={categoryFilter === category ? "secondary" : "ghost"}
                onClick={() => setCategoryFilter(category)}
              >
                {SKILL_CATEGORY_LABELS[category]}
              </Button>
            ))}
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus /> Add Skill
        </Button>
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground bg-secondary/50 rounded-lg p-6 text-center text-sm">
          No skills match your search.
        </p>
      )}

      {groups.map(
        (group) =>
          group.skills.length > 0 && (
            <section key={group.category} className="flex flex-col gap-2.5">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                {SKILL_CATEGORY_LABELS[group.category]}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  ({group.skills.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {group.skills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onEdit={setDialogSkill}
                    onDelete={setSkillPendingDelete}
                  />
                ))}
              </div>
            </section>
          ),
      )}

      {isCreating && <SkillFormDialog onClose={() => setIsCreating(false)} />}
      {dialogSkill && (
        <SkillFormDialog skill={dialogSkill} onClose={() => setDialogSkill(null)} />
      )}

      <AlertDialog
        open={skillPendingDelete !== null}
        onOpenChange={(open) => !open && setSkillPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {skillPendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This also deletes its proficiency history. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
