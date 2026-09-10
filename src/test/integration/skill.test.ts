// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createSkill,
  deleteSkill,
  getSkillById,
  getSkillByName,
  listSkills,
  updateSkill,
  updateSkillProficiency,
} from "@/lib/data/skill";
import { createTestUser, deleteTestUser } from "@/test/helpers/user";

const TEST_SKILL_NAME = "__test__ Skill A";

let userId: string;

beforeAll(async () => {
  userId = (await createTestUser()).id;
});

afterAll(async () => {
  await deleteTestUser(userId);
});

// Skill mutations return null when the skill no longer exists / isn't the caller's (see
// tolerateAlreadyDeleted in src/lib/data/shared.ts) — every call site below expects the skill
// to genuinely exist, so this narrows the type instead of repeating a null check everywhere.
function unwrap<T>(value: T | null): T {
  if (value === null) throw new Error("expected a non-null result");
  return value;
}

afterEach(async () => {
  await prisma.skill.deleteMany({ where: { userId, name: TEST_SKILL_NAME } });
});

describe("Skill", () => {
  it("derives category from proficiency on creation", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
    expect(skill.category).toBe("BETWEEN_30_70");
  });

  it("does not write SkillHistory on initial creation", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
    const history = await prisma.skillHistory.findMany({ where: { skillId: skill.id } });
    expect(history).toHaveLength(0);
  });

  it("records history and updates category when proficiency changes", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });

    const updated = unwrap(await updateSkillProficiency(userId, skill.id, 80));

    expect(updated.proficiencyPercentage).toBe(80);
    expect(updated.category).toBe("MORE_THAN_70");

    const history = await prisma.skillHistory.findMany({ where: { skillId: skill.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ fromPercentage: 50, toPercentage: 80 });
  });

  it("does not record history when the new value equals the current value", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });

    await updateSkillProficiency(userId, skill.id, 50);

    const history = await prisma.skillHistory.findMany({ where: { skillId: skill.id } });
    expect(history).toHaveLength(0);
  });

  it("cascades: deleting a skill deletes its history", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
    await updateSkillProficiency(userId, skill.id, 80);

    await prisma.skill.delete({ where: { id: skill.id } });

    const history = await prisma.skillHistory.findMany({ where: { skillId: skill.id } });
    expect(history).toHaveLength(0);
  });

  it("enforces unique skill names per user", async () => {
    await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
    await expect(
      createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 10 }),
    ).rejects.toThrow();
  });

  it("lets a different user have a skill with the same name", async () => {
    const other = await createTestUser();
    try {
      await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
      await expect(
        createSkill({ userId: other.id, name: TEST_SKILL_NAME, proficiencyPercentage: 10 }),
      ).resolves.toBeTruthy();
    } finally {
      await deleteTestUser(other.id);
    }
  });

  it("getSkillByName finds the created skill", async () => {
    await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
    const found = await getSkillByName(userId, TEST_SKILL_NAME);
    expect(found?.name).toBe(TEST_SKILL_NAME);
  });
});

describe("updateSkill", () => {
  it("updates name/notes without touching proficiency or writing history", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });

    const updated = unwrap(await updateSkill(userId, skill.id, { notes: "New notes" }));

    expect(updated.notes).toBe("New notes");
    expect(updated.proficiencyPercentage).toBe(50);
    const history = await prisma.skillHistory.findMany({ where: { skillId: skill.id } });
    expect(history).toHaveLength(0);
  });

  it("updates proficiency (with history) and other fields together in one call", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });

    const updated = unwrap(
      await updateSkill(userId, skill.id, { notes: "Leveled up", proficiencyPercentage: 90 }),
    );

    expect(updated.notes).toBe("Leveled up");
    expect(updated.proficiencyPercentage).toBe(90);
    expect(updated.category).toBe("MORE_THAN_70");
    const history = await prisma.skillHistory.findMany({ where: { skillId: skill.id } });
    expect(history).toHaveLength(1);
  });

  it("returns null for another user's skill", async () => {
    const other = await createTestUser();
    try {
      const foreign = await createSkill({
        userId: other.id,
        name: TEST_SKILL_NAME,
        proficiencyPercentage: 50,
      });
      await expect(updateSkill(userId, foreign.id, { notes: "nope" })).resolves.toBeNull();
      await expect(updateSkillProficiency(userId, foreign.id, 90)).resolves.toBeNull();
    } finally {
      await deleteTestUser(other.id);
    }
  });
});

describe("deleteSkill", () => {
  it("deletes the skill", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
    await deleteSkill(userId, skill.id);
    const found = await getSkillByName(userId, TEST_SKILL_NAME);
    expect(found).toBeNull();
  });

  it("mutating a skill that no longer exists returns null instead of throwing", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
    await deleteSkill(userId, skill.id);

    await expect(updateSkill(userId, skill.id, { notes: "Too late" })).resolves.toBeNull();
    await expect(updateSkillProficiency(userId, skill.id, 90)).resolves.toBeNull();
    await expect(deleteSkill(userId, skill.id)).resolves.toBeNull();
  });
});

describe("getSkillById / listSkills", () => {
  it("getSkillById includes history ordered most-recent-first", async () => {
    const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
    await updateSkillProficiency(userId, skill.id, 60);
    await updateSkillProficiency(userId, skill.id, 70);

    const found = await getSkillById(userId, skill.id);

    expect(found?.history).toHaveLength(2);
    expect(found?.history[0]).toMatchObject({ fromPercentage: 60, toPercentage: 70 });
  });

  it("listSkills includes the newly created skill and excludes other users' skills", async () => {
    const other = await createTestUser();
    try {
      const skill = await createSkill({ userId, name: TEST_SKILL_NAME, proficiencyPercentage: 50 });
      await updateSkillProficiency(userId, skill.id, 60);
      const foreign = await createSkill({
        userId: other.id,
        name: TEST_SKILL_NAME,
        proficiencyPercentage: 50,
      });

      const all = await listSkills(userId);
      expect(all.find((s) => s.id === skill.id)?.history).toHaveLength(1);
      expect(all.some((s) => s.id === foreign.id)).toBe(false);
    } finally {
      await deleteTestUser(other.id);
    }
  });
});
