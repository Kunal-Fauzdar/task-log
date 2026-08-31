import { Timer } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="border-border bg-card relative w-full max-w-sm overflow-hidden rounded-2xl border p-8 shadow-xl">
        <div className="from-primary to-accent absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r" />
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="from-primary to-accent text-primary-foreground flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg shadow-primary/30">
            <Timer className="size-7" />
          </span>
          <div>
            <h1 className="text-gradient-brand text-2xl font-bold tracking-tight">
              WorkLog Manager
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Enter the password to continue.</p>
          </div>
        </div>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
