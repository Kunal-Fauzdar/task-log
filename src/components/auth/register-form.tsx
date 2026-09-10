"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/lib/actions/auth-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";

// Controlled inputs — same reasoning as LoginForm / every useActionState form in this app.
export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, IDLE_ACTION_STATE);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          required
          aria-invalid={!!fieldError("name")}
        />
        {fieldError("name") && <p className="text-destructive text-sm">{fieldError("name")}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          aria-invalid={!!fieldError("email")}
        />
        {fieldError("email") && <p className="text-destructive text-sm">{fieldError("email")}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          aria-invalid={!!fieldError("password")}
        />
        {fieldError("password") && (
          <p className="text-destructive text-sm">{fieldError("password")}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          aria-invalid={!!fieldError("confirmPassword")}
        />
        {fieldError("confirmPassword") && (
          <p className="text-destructive text-sm">{fieldError("confirmPassword")}</p>
        )}
      </div>
      {state.status === "error" && !state.fieldErrors && state.message && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-link font-medium underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
