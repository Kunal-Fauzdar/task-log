import { prisma } from "@/lib/db";
import { deriveSkillCategory } from "@/lib/domain/skill";
import { tolerateAlreadyDeleted } from "@/lib/data/shared";

// Search/category filtering happens client-side (see src/components/skill/skill-map.tsx) —
// the dataset is a personal SkillMap (dozens of entries, not thousands), so fetching everything
// once and filtering in the browser is simpler and more responsive than round-tripping on every
// keystroke.
export function listSkills() {
  return prisma.skill.findMany({
    orderBy: { name: "asc" },
    include: { history: { orderBy: { changedAt: "desc" } } },
  });
}

export function getSkillByName(name: string) {
  return prisma.skill.findUnique({ where: { name } });
}

export function getSkillById(id: string) {
  return prisma.skill.findUnique({
    where: { id },
    include: { history: { orderBy: { changedAt: "desc" } } },
  });
}

export function createSkill(data: {
  name: string;
  proficiencyPercentage: number;
  notes?: string;
}) {
  return prisma.skill.create({
    data: {
      name: data.name,
      proficiencyPercentage: data.proficiencyPercentage,
      category: deriveSkillCategory(data.proficiencyPercentage),
      notes: data.notes,
    },
  });
}

// Updates name/notes unconditionally, and proficiencyPercentage only through the
// history-recording path below (never set directly here) — kept as one function so the Edit
// Skill dialog can submit a single form.
export async function updateSkill(
  id: string,
  data: { name?: string; notes?: string; proficiencyPercentage?: number },
) {
  if (data.proficiencyPercentage === undefined) {
    return tolerateAlreadyDeleted(
      prisma.skill.update({
        where: { id },
        data: { name: data.name, notes: data.notes },
      }),
    );
  }
  return updateSkillProficiency(id, data.proficiencyPercentage, {
    name: data.name,
    notes: data.notes,
  });
}

export function deleteSkill(id: string) {
  return tolerateAlreadyDeleted(prisma.skill.delete({ where: { id } }));
}

// Records a SkillHistory entry — only for an actual change to an existing skill, never for
// initial creation (see prisma/seed.ts, which uses createSkill directly). Returns null if the
// skill was deleted concurrently (see tolerateAlreadyDeleted in src/lib/data/shared.ts) — uses
// findUnique + an early null-return inside the transaction rather than findUniqueOrThrow, since
// throwing inside a $transaction callback would abort the transaction with that same
// unhandled-P2025 crash this exists to avoid.
export async function updateSkillProficiency(
  id: string,
  newPercentage: number,
  extra?: { name?: string; notes?: string },
) {
  const category = deriveSkillCategory(newPercentage);

  return prisma.$transaction(async (tx) => {
    const current = await tx.skill.findUnique({ where: { id } });
    if (!current) return null;

    if (current.proficiencyPercentage !== newPercentage) {
      await tx.skillHistory.create({
        data: {
          skillId: id,
          fromPercentage: current.proficiencyPercentage,
          toPercentage: newPercentage,
        },
      });
    }

    return tx.skill.update({
      where: { id },
      data: { proficiencyPercentage: newPercentage, category, ...extra },
    });
  });
}
