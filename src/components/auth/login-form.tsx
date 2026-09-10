"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/lib/actions/auth-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";

// Controlled inputs, not defaultValue (CLAUDE.md §3: useActionState resets uncontrolled fields
// after any resolved action, including our own error returns — a wrong-password error would
// otherwise silently wipe what was just typed).
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, IDLE_ACTION_STATE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoFocus
          required
          aria-invalid={state.status === "error"}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          aria-invalid={state.status === "error"}
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign In"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Need an account?{" "}
        <Link href="/register" className="text-link font-medium underline-offset-4 hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
