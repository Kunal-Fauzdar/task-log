import "dotenv/config";

import { hash } from "bcryptjs";

import { prisma } from "../src/lib/db";

const EMAIL = (process.env.E2E_TEST_EMAIL ?? "e2e@worklog.test").toLowerCase();

export function e2eCredentials() {
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) {
    throw new Error("E2E_TEST_PASSWORD is not set in .env (see .env.example).");
  }
  return { email: EMAIL, password };
}

// Upserts the shared e2e account directly (bcrypt hash), so the suite never depends on the
// registration UI having run first. Every domain row now requires a userId, so specs that seed
// data via prisma call this to get one.
export async function getOrCreateE2EUser(): Promise<{ id: string; email: string }> {
  const { password } = e2eCredentials();
  const passwordHash = await hash(password, 10);
  return prisma.user.upsert({
    where: { email: EMAIL },
    create: { email: EMAIL, name: "E2E User", passwordHash },
    update: { passwordHash },
  });
}

export async function e2eUserId(): Promise<string> {
  return (await getOrCreateE2EUser()).id;
}

// A handful of the seeded SkillMap skills, so skill-dependent specs (skillmap, task-skill) have
// something to work with — the real seed only populates the owner account. Idempotent.
const E2E_SKILLS = [
  { name: "React.js", proficiencyPercentage: 85, category: "MORE_THAN_70" },
  { name: "Python", proficiencyPercentage: 82, category: "MORE_THAN_70" },
  { name: "PostgreSQL", proficiencyPercentage: 80, category: "MORE_THAN_70" },
  { name: "Tailwind CSS", proficiencyPercentage: 50, category: "BETWEEN_30_70" },
  { name: "Power BI", proficiencyPercentage: 20, category: "LESS_THAN_30" },
] as const;

export async function ensureE2ESkills(userId: string): Promise<void> {
  for (const skill of E2E_SKILLS) {
    await prisma.skill.upsert({
      where: { userId_name: { userId, name: skill.name } },
      create: { userId, ...skill },
      update: {},
    });
  }
}
