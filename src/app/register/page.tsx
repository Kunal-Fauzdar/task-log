import { RegisterForm } from "@/components/auth/register-form";
import { Logo } from "@/components/layout/logo";

export default function RegisterPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-sm overflow-hidden rounded-xl border">
        <div className="bg-brand-strong h-1 w-full" />
        <div className="flex flex-col gap-6 p-8">
          <div className="flex flex-col gap-3">
            <Logo className="size-11" />
            <div>
              <p className="eyebrow">Get started</p>
              <h1 className="font-display mt-1 text-2xl">Create your account</h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Your own work log, skill map, and reports — private to you.
              </p>
            </div>
          </div>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
