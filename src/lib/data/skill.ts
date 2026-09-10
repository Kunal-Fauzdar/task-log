import { prisma } from "@/lib/db";
import { deriveSkillCategory } from "@/lib/domain/skill";
import { tolerateAlreadyDeleted } from "@/lib/data/shared";

// Every function is scoped to one owner (`userId`). Skill names are unique per user
// (`@@unique([userId, name])`), so two users can each have a "React.js" skill.

export function listSkills(userId: string) {
  return prisma.skill.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { history: { orderBy: { changedAt: "desc" } } },
  });
}

export function getSkillByName(userId: string, name: string) {
  return prisma.skill.findUnique({ where: { userId_name: { userId, name } } });
}

export function getSkillById(userId: string, id: string) {
  return prisma.skill.findFirst({
    where: { id, userId },
    include: { history: { orderBy: { changedAt: "desc" } } },
  });
}

export function createSkill(data: {
  userId: string;
  name: string;
  proficiencyPercentage: number;
  notes?: string;
}) {
  return prisma.skill.create({
    data: {
      userId: data.userId,
      name: data.name,
      proficiencyPercentage: data.proficiencyPercentage,
      category: deriveSkillCategory(data.proficiencyPercentage),
      notes: data.notes,
    },
  });
}

// Updates name/notes unconditionally, and proficiencyPercentage only through the
// history-recording path below — kept as one function so the Edit Skill dialog submits one form.
export async function updateSkill(
  userId: string,
  id: string,
  data: { name?: string; notes?: string; proficiencyPercentage?: number },
) {
  if (data.proficiencyPercentage === undefined) {
    if (!(await prisma.skill.findFirst({ where: { id, userId } }))) return null;
    return tolerateAlreadyDeleted(
      prisma.skill.update({ where: { id }, data: { name: data.name, notes: data.notes } }),
    );
  }
  return updateSkillProficiency(userId, id, data.proficiencyPercentage, {
    name: data.name,
    notes: data.notes,
  });
}

export async function deleteSkill(userId: string, id: string) {
  if (!(await prisma.skill.findFirst({ where: { id, userId } }))) return null;
  return tolerateAlreadyDeleted(prisma.skill.delete({ where: { id } }));
}

// Records a SkillHistory entry — only for an actual change to an existing skill, never for
// initial creation. Returns null if the skill was deleted concurrently or isn't the user's —
// uses findFirst + an early null-return inside the transaction rather than findUniqueOrThrow,
// since throwing inside a $transaction callback would abort it with an unhandled error.
export async function updateSkillProficiency(
  userId: string,
  id: string,
  newPercentage: number,
  extra?: { name?: string; notes?: string },
) {
  const category = deriveSkillCategory(newPercentage);

  return prisma.$transaction(async (tx) => {
    const current = await tx.skill.findFirst({ where: { id, userId } });
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
