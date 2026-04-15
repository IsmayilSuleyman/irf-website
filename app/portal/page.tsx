import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";

export const dynamic = "force-dynamic";

function PortalOption({
  href,
  logo,
  srLabel,
  tone,
}: {
  href: string;
  logo: ReactNode;
  srLabel: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex h-[4.6rem] w-full max-w-[17rem] items-center justify-center rounded-[1.35rem] border border-black/6 ${tone} px-6 shadow-[0_16px_38px_rgba(68,103,86,0.08)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-black/10 hover:shadow-[0_20px_48px_rgba(68,103,86,0.12)]`}
    >
      <span className="sr-only">{srLabel}</span>
      {logo}
    </Link>
  );
}

export default async function PortalPage() {
  const { reason, user } = await getSupabaseServerUser();

  if (reason === "missing_config") {
    redirect("/welcome?setup=supabase");
  }

  if (reason === "error") {
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
      <section className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1680px] items-center justify-center overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(244,250,246,0.92)_48%,rgba(231,246,237,0.96))] px-6 py-16 shadow-[0_28px_90px_rgba(48,94,63,0.08)] sm:min-h-[calc(100vh-2rem)] sm:rounded-[2.75rem] sm:px-10 lg:px-16">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.78),rgba(255,255,255,0)_32%),radial-gradient(circle_at_78%_14%,rgba(226,240,255,0.28),rgba(226,240,255,0)_24%),radial-gradient(circle_at_72%_76%,rgba(205,244,219,0.42),rgba(205,244,219,0)_30%)]"
        />
        <div
          aria-hidden
          className="absolute inset-4 rounded-[1.7rem] border border-white/50 bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] sm:inset-8 sm:rounded-[2.15rem]"
        />

        <div className="relative flex w-full max-w-[22rem] flex-col items-center text-center">
          <h1 className="text-[clamp(1.7rem,2.4vw,2.35rem)] font-black leading-[1.08] tracking-[-0.05em] text-[#171717]">
            Keçid etmək istədiyiniz portalı seçin:
          </h1>

          <div className="mt-5 flex w-full flex-col items-center gap-3 sm:mt-6">
            <PortalOption
              href="/dashboard"
              srLabel="İRF portalına keç"
              tone="bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(242,250,245,0.96))]"
              logo={
                <div className="w-[12rem] sm:w-[12.5rem]">
                  <Logo width={200} priority />
                </div>
              }
            />
            <PortalOption
              href="/bank"
              srLabel="İsmayılBank portalına keç"
              tone="bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(234,241,255,0.96))]"
              logo={<IsmayilBankLogo size={34} />}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
