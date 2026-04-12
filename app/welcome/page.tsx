import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MotionSection } from "@/components/MotionSection";

export default function WelcomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
      <MotionSection delay={0} className="flex flex-col items-center gap-10 w-full max-w-lg">
        <Logo size={80} />

        <div className="glass w-full rounded-3xl p-10 flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-black/85">
            Xoş gəlmisiniz
          </h1>
          <p className="text-base text-black/50 leading-relaxed">
            İsmayıl Rifah Fondu — şəxsi investisiya portfelinizi izləyin.
          </p>
          <Link
            href="/login"
            className="mt-2 inline-block rounded-xl bg-brand-green px-8 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Portfoliyoma keç
          </Link>
        </div>
      </MotionSection>
    </main>
  );
}
