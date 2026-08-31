import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-sm overflow-hidden rounded-xl border">
        <div className="bg-brand-strong h-1 w-full" />
        <div className="flex flex-col gap-6 p-8">
          <div className="flex flex-col gap-3">
            <Logo className="size-11" />
            <div>
              <p className="eyebrow">Private instance</p>
              <h1 className="font-display mt-1 text-2xl">WorkLog Manager</h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Enter the password to open your work log.
              </p>
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
