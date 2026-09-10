"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";

import { changePasswordAction, updateNameAction } from "@/lib/actions/auth-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountForms({ email, name }: { email: string; name: string }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="bg-secondary flex flex-col gap-3 rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <div className="flex flex-col gap-1.5">
          <Label>Email</Label>
          <Input value={email} disabled readOnly />
          <p className="text-muted-foreground text-xs">Your email is your login and can&apos;t be changed here.</p>
        </div>
        <NameForm name={name} />
      </section>

      <section className="bg-accent/15 flex flex-col gap-3 rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Change password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}

function NameForm({ name }: { name: string }) {
  const [state, formAction, isPending] = useActionState(updateNameAction, IDLE_ACTION_STATE);
  const [value, setValue] = useState(name);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-name">Display name</Label>
        <Input
          id="account-name"
          name="name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
          aria-invalid={!!state.fieldErrors?.name}
        />
        {state.fieldErrors?.name && (
          <p className="text-destructive text-sm">{state.fieldErrors.name[0]}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          <Save className="size-4" /> {isPending ? "Saving…" : "Save name"}
        </Button>
        <span role="status" className="text-muted-foreground text-sm">
          {state.status === "success" && "Name updated."}
        </span>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, IDLE_ACTION_STATE);
  // Reset the fields after a successful change — snapshot-compare during render, not an effect
  // (react-hooks/set-state-in-effect, CLAUDE.md §3).
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success") {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          required
          aria-invalid={!!fieldError("currentPassword")}
        />
        {fieldError("currentPassword") && (
          <p className="text-destructive text-sm">{fieldError("currentPassword")}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          required
          aria-invalid={!!fieldError("newPassword")}
        />
        {fieldError("newPassword") && (
          <p className="text-destructive text-sm">{fieldError("newPassword")}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
          aria-invalid={!!fieldError("confirmPassword")}
        />
        {fieldError("confirmPassword") && (
          <p className="text-destructive text-sm">{fieldError("confirmPassword")}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          <Save className="size-4" /> {isPending ? "Saving…" : "Update password"}
        </Button>
        <span role="status" className="text-muted-foreground text-sm">
          {state.status === "success" && "Password updated."}
        </span>
      </div>
    </form>
  );
}
