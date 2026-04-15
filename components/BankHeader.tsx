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
  const canLogout = supabase != null;

  const onLogout = async () => {
    if (!supabase) {
      router.push("/welcome?setup=supabase");
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-black/6 bg-white/80 px-5 py-4 backdrop-blur-xl sm:px-8"
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="inline-flex items-center" aria-label="IRF">
            <div className="w-[128px] sm:w-[156px]">
              <Logo width={156} priority />
            </div>
          </Link>
          <span className="h-6 w-px bg-black/10" aria-hidden />
          <div className="inline-flex items-center gap-2">
            <IsmayilBankLogo size={22} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/58">
              İsmayılBank
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <span className="hidden text-xs text-black/42 sm:inline">{dateLabel}</span>
          <button
            onClick={onLogout}
            disabled={!canLogout}
            className="text-xs uppercase tracking-[0.18em] text-black/50 transition hover:text-[#2F61D8]"
          >
            Çıxış
          </button>
        </div>
      </div>
    </motion.header>
  );
}
