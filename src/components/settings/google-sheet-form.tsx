"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Link2, LogOut, RefreshCw } from "lucide-react";

import {
  disconnectGoogleAction,
  syncGoogleSheetNowAction,
  updateGoogleSheetAction,
} from "@/lib/actions/settings-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  sheetUrl: string | null;
  oauthConfigured: boolean;
  googleEmail: string | null;
  // Set only when the user hasn't connected Google but the server has the legacy bot account.
  serviceAccountEmail: string | null;
  syncedAt: string | null;
  syncError: string | null;
  // ?google=… from the OAuth callback redirect.
  googleStatus: string | null;
};

const GOOGLE_STATUS_MESSAGES: Record<string, { text: string; error: boolean }> = {
  connected: { text: "Google account connected.", error: false },
  cancelled: { text: "Google connection was cancelled.", error: true },
  scope: { text: "Please tick the Google Sheets permission when connecting — it's needed to update your sheet.", error: true },
  invalid: { text: "That Google sign-in link expired. Please try connecting again.", error: true },
  failed: { text: "Couldn't connect your Google account. Please try again.", error: true },
  "not-configured": { text: "Google sign-in isn't set up on this server yet.", error: true },
};

export function GoogleSheetForm({
  sheetUrl,
  oauthConfigured,
  googleEmail,
  serviceAccountEmail,
  syncedAt,
  syncError,
  googleStatus,
}: Props) {
  const [linkState, linkAction, isLinking] = useActionState(updateGoogleSheetAction, IDLE_ACTION_STATE);
  const [syncState, syncAction, isSyncing] = useActionState(syncGoogleSheetNowAction, IDLE_ACTION_STATE);
  const [isDisconnecting, startDisconnect] = useTransition();
  // Controlled (CLAUDE.md §3): an error return must not wipe the pasted link.
  const [value, setValue] = useState(sheetUrl ?? "");
  // Re-sync with the server value after a save/unlink re-renders this instance with new props.
  const [seenSheetUrl, setSeenSheetUrl] = useState(sheetUrl);
  if (seenSheetUrl !== sheetUrl) {
    setSeenSheetUrl(sheetUrl);
    setValue(sheetUrl ?? "");
  }

  const connected = Boolean(googleEmail);
  // The sheet link is usable once the app has *some* way to write: the user's Google account,
  // or (legacy) the shared bot account.
  const canLink = connected || Boolean(serviceAccountEmail);
  const statusMessage = googleStatus ? GOOGLE_STATUS_MESSAGES[googleStatus] : undefined;

  if (!oauthConfigured && !serviceAccountEmail) {
    return (
      <section className="panel flex max-w-2xl flex-col gap-3.5 p-5">
        <h2 className="text-sm font-semibold">Google Sheet sync</h2>
        <p className="text-muted-foreground bg-muted rounded-lg p-3 text-sm">
          Sheet sync isn’t set up on this server yet (missing Google credentials).
        </p>
      </section>
    );
  }

  return (
    <section className="panel flex max-w-2xl flex-col gap-3.5 p-5">
      <div>
        <h2 className="text-sm font-semibold">Google Sheet sync</h2>
        <p className="text-muted-foreground text-sm">
          Every change you make here is copied automatically into your Google Sheet, into that
          month’s tab (e.g. “November” — created if it doesn’t exist yet), in the same layout as
          the Excel export. The website is the source of truth: edits typed directly into a
          synced month tab get overwritten on the next sync. Other tabs are never touched.
        </p>
      </div>

      {statusMessage && (
        <p role="status" className={statusMessage.error ? "text-destructive text-sm" : "text-sm"}>
          {statusMessage.text}
        </p>
      )}

      {/* Step 1 — Google account. Always rendered so the option is discoverable; disabled with an
          explanation until the server has OAuth credentials. */}
      {!oauthConfigured ? (
        <div className="bg-card flex flex-col gap-2 rounded-lg p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Connecting a Google account isn’t available yet — the server is missing
            <code className="label-mono mx-1">GOOGLE_OAUTH_CLIENT_ID</code>/
            <code className="label-mono mx-1">GOOGLE_OAUTH_CLIENT_SECRET</code>
            (see DEPLOYMENT.md §12 A).
          </p>
          <Button size="sm" className="shrink-0" disabled>
            Connect Google account
          </Button>
        </div>
      ) : (
        <div className="bg-card flex flex-col gap-2 rounded-lg p-3.5 sm:flex-row sm:items-center sm:justify-between">
          {connected ? (
            <>
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="text-link size-4 shrink-0" />
                <span>
                  Connected as <strong className="break-all">{googleEmail}</strong>
                </span>
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isDisconnecting}
                onClick={() => startDisconnect(() => disconnectGoogleAction())}
              >
                <LogOut className="size-4" /> {isDisconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm">
                Connect the Google account that owns your sheet — no sharing needed.
              </p>
              {/* Plain link, not a form/action: it's a full-page redirect to Google's consent screen. */}
              <Button asChild size="sm" className="shrink-0">
                <a href="/api/google/connect">Connect Google account</a>
              </Button>
            </>
          )}
        </div>
      )}

      {!connected && serviceAccountEmail && (
        <p className="text-muted-foreground text-xs">
          {oauthConfigured ? "Or, without connecting: " : ""}share your sheet with{" "}
          <code className="label-mono bg-card rounded px-1 py-0.5 break-all">{serviceAccountEmail}</code> as an
          Editor, then paste its link below.
        </p>
      )}

      {/* Step 2 — which sheet */}
      {canLink && (
        <form action={linkAction} className="flex flex-col gap-2">
          <label htmlFor="sheetUrl" className="text-sm font-medium">
            Sheet link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="sheetUrl"
              name="sheetUrl"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              aria-invalid={Boolean(linkState.fieldErrors?.sheetUrl)}
            />
            <Button type="submit" size="sm" disabled={isLinking} className="shrink-0">
              <Link2 className="size-4" /> {isLinking ? "Linking…" : sheetUrl ? "Update link" : "Link sheet"}
            </Button>
          </div>
          {linkState.fieldErrors?.sheetUrl && (
            <p className="text-destructive text-sm">{linkState.fieldErrors.sheetUrl[0]}</p>
          )}
          <p
            role="status"
            className={linkState.status === "error" ? "text-destructive text-sm" : "text-muted-foreground text-sm"}
          >
            {!linkState.fieldErrors && linkState.message}
          </p>
          {sheetUrl && (
            <p className="text-muted-foreground text-xs">To stop syncing, clear the field and save.</p>
          )}
        </form>
      )}

      {sheetUrl && canLink && (
        <div className="border-border flex flex-col gap-2 border-t pt-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <form action={syncAction}>
              <Button type="submit" size="sm" variant="outline" disabled={isSyncing}>
                <RefreshCw className={isSyncing ? "size-4 animate-spin" : "size-4"} />
                {isSyncing ? "Syncing…" : "Sync now"}
              </Button>
            </form>
            <Button asChild size="sm" variant="ghost">
              <a href={sheetUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open sheet
              </a>
            </Button>
          </div>
          <p role="status" className="text-sm">
            {syncState.status !== "idle" ? (
              <span className={syncState.status === "error" ? "text-destructive" : "text-muted-foreground"}>
                {syncState.message}
              </span>
            ) : syncError ? (
              <span className="text-destructive">Last sync failed: {syncError}</span>
            ) : syncedAt ? (
              // Server and browser timezones can differ — the browser's rendering wins.
              <span className="text-muted-foreground" suppressHydrationWarning>
                Last synced {new Date(syncedAt).toLocaleString()}
              </span>
            ) : null}
          </p>
        </div>
      )}
    </section>
  );
}
