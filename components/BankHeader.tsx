"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";
import { Logo } from "@/components/Logo";

export function BankHeader({ dateLabel }: { dateLabel: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-black/8 bg-white/78 px-5 py-5 backdrop-blur-xl sm:px-8 lg:px-10"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-[1.15rem] border border-white/70 bg-white px-4 py-3 shadow-[0_18px_45px_rgba(72,108,82,0.08)]">
              <div className="w-[156px] sm:w-[220px]">
                <Logo width={220} priority />
              </div>
            </div>
            <div className="inline-flex rounded-[1.15rem] border border-[#f4b3ba] bg-[linear-gradient(135deg,rgba(244,123,131,0.22),rgba(255,214,218,0.42))] px-4 py-3 shadow-[0_18px_45px_rgba(241,110,115,0.14)]">
              <IsmayilBankLogo size={34} />
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3 text-[clamp(1.15rem,2vw,1.85rem)] font-black tracking-[-0.06em] text-[#151515] transition hover:text-[#2F61D8]"
          >
            <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2F61D8]">
              IRF
            </span>
            <span>Portfelimə keçid et</span>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-6 sm:justify-end">
          <span className="text-sm text-black/42">{dateLabel}</span>
          <button
            onClick={onLogout}
            className="text-sm uppercase tracking-[0.18em] text-black/58 transition hover:text-[#2F61D8]"
          >
            Çıxış
          </button>
        </div>
      </div>
    </motion.header>
  );
}
