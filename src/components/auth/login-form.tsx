"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/lib/actions/auth-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";

// Controlled input, not defaultValue (CLAUDE.md §3: useActionState resets uncontrolled fields
// after any resolved action, including our own error returns — a wrong-password error would
// otherwise silently wipe what was just typed).
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, IDLE_ACTION_STATE);
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          required
          aria-invalid={state.status === "error"}
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
