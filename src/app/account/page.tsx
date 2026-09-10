import { UserCog } from "lucide-react";

import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/layout/page-header";
import { AccountForms } from "@/components/account/account-form";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={UserCog}
        eyebrow="Account"
        title="Your account"
        description="Update your display name or password."
      />
      <AccountForms email={user.email} name={user.name} />
    </div>
  );
}
