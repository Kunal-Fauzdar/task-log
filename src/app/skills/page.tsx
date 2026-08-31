import { GraduationCap } from "lucide-react";

import { listSkills } from "@/lib/data/skill";
import { PageHeader } from "@/components/layout/page-header";
import { SkillMap } from "@/components/skill/skill-map";

export default async function SkillsPage() {
  const skills = await listSkills();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={GraduationCap}
        eyebrow="Proficiency"
        title="SkillMap"
        description="Every skill you use, grouped into three proficiency bands, with a record of how each has changed."
      />
      <SkillMap skills={skills} />
    </div>
  );
}
