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
          <IsmayilBankLogo size={28} />
          <Link
            href="/dashboard"
            aria-label="İRF hesabına keç"
            className="inline-flex items-center gap-2 rounded border border-black/12 bg-white/80 px-2 py-1.5 transition hover:-translate-y-px hover:border-[#16a34a]/30 hover:shadow-sm sm:px-3 sm:py-2"
          >
            <span aria-hidden className="text-sm leading-none text-black/55 sm:hidden">→</span>
            <div className="w-[80px]">
              <Logo width={80} />
            </div>
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-black/55 sm:inline">
              Hesabına Keç
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href="/portal"
            className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-black/42 transition hover:text-[#2F61D8] sm:inline"
          >
            Portal
          </Link>
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
