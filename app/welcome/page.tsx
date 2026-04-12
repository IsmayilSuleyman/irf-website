"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
});

export default function WelcomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
      {/* Hero */}
      <motion.div {...fade(0)} className="flex flex-col items-center gap-4 mb-14 text-center">
        <Logo size={72} />
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-black/85">
          İsmayıl Ailə Xidmətləri
        </h1>
        <p className="max-w-md text-base text-black/45 leading-relaxed">
          Portfel idarəetməsi və bank məhsulları — hamısı bir yerdə.
        </p>
      </motion.div>

      {/* Product cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">

        {/* IRF Portfolio card */}
        <motion.div {...fade(0.1)} className="glass rounded-3xl p-8 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-xl">
              📈
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-green">
                İRF
              </p>
              <h2 className="text-lg font-bold text-black/85 leading-tight">
                Rifah Fondu
              </h2>
            </div>
          </div>

          <p className="text-sm text-black/50 leading-relaxed flex-1">
            Şəxsi investisiya portfelinizi real vaxt rejimində izləyin.
            Aktivlər, gəlirlilik və bölgü — bir baxışda.
          </p>

          <div className="flex flex-wrap gap-2 text-xs text-black/40">
            <span className="glass-tinted rounded-full px-3 py-1">Portfel</span>
            <span className="glass-tinted rounded-full px-3 py-1">Analitika</span>
            <span className="glass-tinted rounded-full px-3 py-1">Real vaxt</span>
          </div>

          <Link
            href="/login"
            className="mt-1 w-full rounded-xl bg-brand-green py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Portfoliyoma keç →
          </Link>
        </motion.div>

        {/* İsmayılBanka card */}
        <motion.div {...fade(0.18)} className="glass rounded-3xl p-8 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-xl">
              🏦
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                İsmayılBanka
              </p>
              <h2 className="text-lg font-bold text-black/85 leading-tight">
                Bank Məhsulları
              </h2>
            </div>
          </div>

          <p className="text-sm text-black/50 leading-relaxed flex-1">
            Depozit və kredit faizlərini müqayisə edin. Ən sərfəli şərtləri
            tapın və qərarlarınızı daha ağıllı verin.
          </p>

          <div className="flex flex-wrap gap-2 text-xs text-black/40">
            <span className="rounded-full border border-blue-200 bg-blue-50/60 px-3 py-1">Depozit</span>
            <span className="rounded-full border border-blue-200 bg-blue-50/60 px-3 py-1">Kredit</span>
            <span className="rounded-full border border-blue-200 bg-blue-50/60 px-3 py-1">Müqayisə</span>
          </div>

          <Link
            href="/ismayilbank"
            className="mt-1 w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            İsmayılBanka keç →
          </Link>
        </motion.div>

      </div>

      {/* Footer note */}
      <motion.p {...fade(0.28)} className="mt-12 text-xs text-black/25">
        © {new Date().getFullYear()} İsmayıl Süleyman — Bütün hüquqlar qorunur
      </motion.p>
    </main>
  );
}
