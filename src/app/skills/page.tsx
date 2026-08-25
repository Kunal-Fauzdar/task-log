import { listSkills } from "@/lib/data/skill";
import { SkillMap } from "@/components/skill/skill-map";

export default async function SkillsPage() {
  const skills = await listSkills();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">SkillMap</h1>
      <SkillMap skills={skills} />
    </div>
  );
}
