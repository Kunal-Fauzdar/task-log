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
import { PageHeader } from "@/components/layout/page-header";
import { SkillCard, type SkillCardData } from "@/components/skill/skill-card";
import { SkillFormDialog } from "@/components/skill/skill-form-dialog";

function FilterTab({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "bg-primary/15 text-link flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"
          : "text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
      }
    >
      {children}
      <span className="bg-secondary rounded px-1.5 text-xs tabular-nums">{count}</span>
    </button>
  );
}

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
      <PageHeader
        title="Skill Map"
        description="Track and improve your skills. Organize them into proficiency bands."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="border-border flex flex-wrap gap-1 rounded-lg border p-1" role="group" aria-label="Filter by category">
            <FilterTab active={categoryFilter === "ALL"} onClick={() => setCategoryFilter("ALL")} count={skills.length}>
              All
            </FilterTab>
            {SKILL_CATEGORY_ORDER.map((category) => (
              <FilterTab
                key={category}
                active={categoryFilter === category}
                onClick={() => setCategoryFilter(category)}
                count={skills.filter((s) => s.category === category).length}
              >
                {SKILL_CATEGORY_LABELS[category]}
              </FilterTab>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <Button onClick={() => setIsCreating(true)}>
            <Plus /> Add Skill
          </Button>
        </div>
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
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                {SKILL_CATEGORY_LABELS[group.category]}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  ({group.skills.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
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
