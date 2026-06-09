import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="glass p-10">
          <div className="mb-10 flex w-full flex-col items-center">
            <div className="w-full max-w-[250px]">
              <Logo width={250} priority />
            </div>
            <p className="mt-4 text-center text-sm leading-6 text-black/45 dark:text-white/50">
              Bir girişlə həm IRF, həm də İsmayılBank açılır.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <LoginForm />
            <Link
              href="/welcome"
              className="rounded-xl border border-brand-green/20 bg-white/70 dark:bg-white/10 px-4 py-3 text-center text-sm font-medium uppercase tracking-[0.18em] text-black/70 dark:text-white/75 transition hover:-translate-y-0.5 hover:border-brand-green hover:text-brand-green dark:hover:text-emerald-400"
            >
              Geriyə qayıt
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
