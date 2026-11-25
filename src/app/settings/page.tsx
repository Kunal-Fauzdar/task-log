import { requireUser } from "@/lib/auth/current-user";
import { getSheetSettings, getWorkingDays } from "@/lib/data/settings";
import { spreadsheetUrl } from "@/lib/domain/sheets";
import { getServiceAccountEmail, isServiceAccountConfigured } from "@/lib/sheets/google-client";
import { isGoogleOAuthConfigured } from "@/lib/sheets/google-oauth";
import { PageHeader } from "@/components/layout/page-header";
import { GoogleSheetForm } from "@/components/settings/google-sheet-form";
import { WorkingDaysForm } from "@/components/settings/working-days-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const user = await requireUser();
  const [workingDays, sheet, { google }] = await Promise.all([
    getWorkingDays(user.id),
    getSheetSettings(user.id),
    searchParams,
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Configure your working days and preferences."
      />
      <WorkingDaysForm workingDays={workingDays} />
      <GoogleSheetForm
        sheetUrl={sheet.googleSheetId ? spreadsheetUrl(sheet.googleSheetId) : null}
        oauthConfigured={isGoogleOAuthConfigured()}
        googleEmail={sheet.googleAccountEmail}
        serviceAccountEmail={isServiceAccountConfigured() ? getServiceAccountEmail() : null}
        syncedAt={sheet.sheetSyncedAt?.toISOString() ?? null}
        syncError={sheet.sheetSyncError}
        googleStatus={google ?? null}
      />
    </div>
  );
}
