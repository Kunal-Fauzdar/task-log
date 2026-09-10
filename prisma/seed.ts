import "dotenv/config";

import { createSkill, getSkillByName } from "../src/lib/data/skill.ts";
import { prisma } from "../src/lib/db.ts";

// The SkillMap seed now belongs to a user. By default that's the "owner" account the
// multi-user migration created for all pre-existing data; override with SEED_OWNER_EMAIL.
const OWNER_EMAIL = (process.env.SEED_OWNER_EMAIL ?? "kavya.b.analyst@gmail.com").toLowerCase();
const OWNER_NAME = process.env.SEED_OWNER_NAME ?? "Kavya";

// Initial proficiency values from the user's SkillMap screenshot (spec §20). These are seed
// defaults, editable afterwards through the Skills UI (Phase 6) — not hardcoded UI text.
const SKILL_SEED_DATA: { name: string; proficiencyPercentage: number }[] = [
  // Less than 30%
  { name: "Power BI", proficiencyPercentage: 20 },
  { name: "Network", proficiencyPercentage: 15 },
  { name: "Data security", proficiencyPercentage: 15 },
  { name: "Ethical Hacking", proficiencyPercentage: 10 },
  { name: "Linux commands", proficiencyPercentage: 20 },

  // 30 to 70%
  { name: "Java", proficiencyPercentage: 55 },
  { name: "Data science", proficiencyPercentage: 40 },
  { name: "ML", proficiencyPercentage: 35 },
  { name: "Tailwind CSS", proficiencyPercentage: 50 },
  { name: "Java Swing", proficiencyPercentage: 40 },
  { name: "Web Scraping", proficiencyPercentage: 45 },
  { name: "Excel", proficiencyPercentage: 60 },
  { name: "Material UI", proficiencyPercentage: 50 },
  { name: "Web sockets", proficiencyPercentage: 45 },
  { name: "Django REST", proficiencyPercentage: 40 },

  // More than 70%
  { name: "HTML", proficiencyPercentage: 90 },
  { name: "CSS", proficiencyPercentage: 88 },
  { name: "Javascript", proficiencyPercentage: 85 },
  { name: "Node.js", proficiencyPercentage: 80 },
  { name: "Express.js", proficiencyPercentage: 78 },
  { name: "React.js", proficiencyPercentage: 85 },
  { name: "Mongodb", proficiencyPercentage: 75 },
  { name: "Python", proficiencyPercentage: 82 },
  { name: "Django", proficiencyPercentage: 78 },
  { name: "PostgreSQL", proficiencyPercentage: 80 },
];

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    // "__RESET_REQUIRED__" is a sentinel no bcrypt.compare can match — set a real password with
    // `npx tsx scripts/set-password.ts`. A pre-existing owner (from the migration) keeps its hash.
    create: { email: OWNER_EMAIL, name: OWNER_NAME, passwordHash: "__RESET_REQUIRED__" },
    update: {},
  });

  let created = 0;
  let skipped = 0;

  for (const skill of SKILL_SEED_DATA) {
    const existing = await getSkillByName(owner.id, skill.name);
    if (existing) {
      skipped++;
      continue;
    }
    await createSkill({ ...skill, userId: owner.id });
    created++;
  }

  console.log(
    `Skill seed complete for ${OWNER_EMAIL}: ${created} created, ${skipped} already existed.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
