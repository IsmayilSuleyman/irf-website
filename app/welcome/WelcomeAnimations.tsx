"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

const riseIn = (delay: number, y = 24) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const, delay },
});

export function WelcomeAnimations({
  showSetupNotice,
  children,
}: {
  showSetupNotice: boolean;
  children: ReactNode;
}) {
  // Children order: ctaButton, irfCard, bankCard
  const childArray = Array.isArray(children) ? children : [children];
  const [ctaButton, irfCard, bankCard] = childArray;

  return (
    <div className="relative z-10 flex min-h-[calc(100vh-0.75rem)] flex-col px-6 py-8 sm:px-10 sm:py-12 lg:px-20 lg:py-16">
      {showSetupNotice ? (
        <motion.div
          {...riseIn(0.03, 12)}
          className="mt-6 max-w-3xl rounded-[1.6rem] border border-[#B6CDFE] bg-white/78 px-5 py-4 shadow-[0_18px_44px_rgba(66,96,175,0.12)] backdrop-blur-md sm:px-6"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2F61D8]">
            Qurasdirma xetasi
          </p>
          <p className="mt-2 text-sm leading-6 text-black/58 sm:text-[0.98rem]">
            Supabase ayarlari Vercel-de tam qurasdirilmayib. Buna gore giris hissesi
            mueqqeti olaraq deaktivdir. `NEXT_PUBLIC_SUPABASE_URL` ve
            `NEXT_PUBLIC_SUPABASE_ANON_KEY` deyerlerini Vercel project settings-e
            elave etdikden sonra portal yeniden ishleyecek.
          </p>
        </motion.div>
      ) : null}

      <motion.div
        {...riseIn(0.06)}
        className="mt-6 max-w-[60rem] rounded-[2.25rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.62),rgba(255,255,255,0.34))] px-5 py-5 shadow-[0_18px_60px_rgba(106,149,121,0.06)] backdrop-blur-[10px] sm:px-8 sm:py-7 lg:px-10"
      >
        <h1 className="text-[clamp(3.5rem,7.2vw,6.1rem)] font-black leading-[0.92] tracking-[-0.08em] text-[#222222]">
          İsmayıl Maliyyə Xidmətləri
        </h1>
        <p className="mt-5 max-w-[46rem] text-[clamp(1.35rem,2.3vw,2.2rem)] leading-[1.15] tracking-[-0.05em] text-black/40">
          Portfel idarəetməsi və bank məhsulları, hamısı bir yerdə.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          {ctaButton}
          <p className="max-w-xs text-sm leading-6 text-black/48">
            Bir girişlə həm IRF portfeliniz, həm də IsmayılBank hesabınız açılır.
          </p>
        </div>
      </motion.div>

      <motion.div
        {...riseIn(0.14)}
        className="mt-8 grid max-w-[52rem] gap-6 lg:grid-cols-2"
      >
        {irfCard}
        {bankCard}
      </motion.div>

      <motion.p
        {...riseIn(0.22, 16)}
        className="mt-auto pt-10 text-center text-sm tracking-[-0.02em] text-black/28"
      >
        © {new Date().getFullYear()} Ismayıl Süleyman. Bütün hüquqlar qorunur
      </motion.p>
    </div>
  );
}
