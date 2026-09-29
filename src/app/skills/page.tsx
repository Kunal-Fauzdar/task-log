import { requireUser } from "@/lib/auth/current-user";
import { listSkills } from "@/lib/data/skill";
import { SkillMap } from "@/components/skill/skill-map";

export default async function SkillsPage() {
  const user = await requireUser();
  const skills = await listSkills(user.id);

  return <SkillMap skills={skills} />;
}
