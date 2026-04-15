import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";

export const dynamic = "force-dynamic";

function displayNameOf(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.display_name as string) ||
    null
  );
}

function PortalCard({
  accent,
  description,
  href,
  label,
  logo,
  title,
}: {
  accent: string;
  description: string;
  href: string;
  label: string;
  logo: ReactNode;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-[2rem] border border-white/70 bg-white/72 p-7 shadow-[0_24px_60px_rgba(83,131,101,0.12)] backdrop-blur-xl transition hover:-translate-y-1 sm:p-9"
    >
      <div className="inline-flex w-fit rounded-[1.2rem] border border-black/8 bg-white/88 px-4 py-3 shadow-[0_16px_38px_rgba(66,96,175,0.08)]">
        {logo}
      </div>
      <p className={`mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] ${accent}`}>
        {label}
      </p>
      <h2 className="mt-2 text-[2rem] font-black tracking-[-0.06em] text-[#161616]">
        {title}
      </h2>
      <p className="mt-4 max-w-md text-[1.02rem] leading-7 tracking-[-0.02em] text-black/52">
        {description}
      </p>
      <span className="mt-8 inline-flex w-fit rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold tracking-[-0.02em] text-black/65 transition group-hover:border-current group-hover:text-black">
        Aç
      </span>
    </Link>
  );
}

export default async function PortalPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = displayNameOf(user.user_metadata);

  return (
    <main className="min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2.4rem] border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(242,250,245,0.9)_48%,rgba(229,246,235,0.92))] p-6 shadow-[0_28px_90px_rgba(48,94,63,0.08)] sm:p-8 lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(255,255,255,0.76),rgba(255,255,255,0)_30%),radial-gradient(circle_at_74%_78%,rgba(205,244,219,0.54),rgba(205,244,219,0)_26%)]"
        />

        <div className="relative">
          <div className="inline-flex rounded-[1.2rem] border border-white/70 bg-white/88 px-5 py-3 shadow-[0_16px_38px_rgba(66,96,175,0.10)]">
            <Logo width={180} priority />
          </div>

          <h1 className="mt-8 text-[clamp(3rem,7vw,5.6rem)] font-black leading-[0.92] tracking-[-0.08em] text-[#222222]">
            Bir giriş, iki portal
          </h1>
          <p className="mt-5 max-w-3xl text-[clamp(1.15rem,2vw,1.65rem)] leading-[1.2] tracking-[-0.04em] text-black/42">
            {name ? `${name}, ` : ""}
            eyni hesabla həm İRF portfelinə, həm də İsmayılBank hesabına daxil
            ola bilərsiniz.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <PortalCard
              href="/dashboard"
              label="IRF"
              title="Portfel dashboard"
              description="Holders, pay dəyəri, portfel dinamikası və transaksiyaları burada görün."
              accent="text-[#14A44D]"
              logo={
                <div className="w-[180px] sm:w-[210px]">
                  <Logo width={210} priority />
                </div>
              }
            />
            <PortalCard
              href="/bank"
              label="İSMAYILBANK"
              title="Şəxsi bank hesabı"
              description="Depozit cəmi və outstanding cash loan qalığını yalnız sizə bağlı giriş ilə görün."
              accent="text-[#2F61D8]"
              logo={<IsmayilBankLogo size={42} />}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
