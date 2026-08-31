import { Sparkles } from "lucide-react";

import { listSkills } from "@/lib/data/skill";
import { PageHeader } from "@/components/layout/page-header";
import { SkillMap } from "@/components/skill/skill-map";

export default async function SkillsPage() {
  const skills = await listSkills();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Sparkles}
        title="SkillMap"
        description="Track proficiency across every skill you use."
        accent="violet"
      />
      <SkillMap skills={skills} />
    </div>
  );
}
