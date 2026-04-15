"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";

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
      className="sticky top-0 z-40 -mx-6 mb-12 border-b border-[rgba(47,97,216,0.14)] bg-white/55 px-6 backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-4">
          <div className="w-[150px] sm:w-[190px]">
            <IsmayilBankLogo size={38} />
          </div>
          <Link
            href="/portal"
            className="hidden rounded-full border border-blue-200/70 bg-white/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2F61D8] transition hover:-translate-y-0.5 hover:border-blue-300 sm:inline-flex"
          >
            Portal
          </Link>
        </div>
        <div className="flex items-center gap-5">
          <span className="hidden text-xs text-black/45 sm:inline">{dateLabel}</span>
          <button
            onClick={onLogout}
            className="text-xs uppercase tracking-[0.18em] text-black/60 transition hover:text-[#2F61D8]"
          >
            Çıxış
          </button>
        </div>
      </div>
    </motion.header>
  );
}
