import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">WorkLog Manager</h1>
          <p className="text-muted-foreground text-sm">Enter the password to continue.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
