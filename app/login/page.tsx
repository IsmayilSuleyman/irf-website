import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="glass p-10">
          <div className="mb-10 flex flex-col items-center gap-4 text-center">
            <Logo size={48} />
            <h1 className="text-lg font-semibold tracking-tight text-brand-green">
              İsmayıl Rifah Fondu
            </h1>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
