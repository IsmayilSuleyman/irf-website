"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const riseIn = (delay: number, y = 24) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const, delay },
});

function SurfaceBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`absolute rounded-[28px] border border-white/35 bg-white/18 shadow-[0_24px_70px_rgba(74,121,90,0.08)] backdrop-blur-[3px] ${className}`}
    />
  );
}

function PortfolioIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden>
      <rect
        x="5.5"
        y="5.5"
        width="29"
        height="29"
        rx="7"
        fill="#FFFFFF"
        stroke="#111827"
        strokeWidth="1.5"
      />
      <path d="M12 29V15.5" stroke="#111827" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 29H29" stroke="#111827" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M13.5 24.5L19 19L23 22L29 13.5"
        fill="none"
        stroke="#EF4444"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden>
      <rect
        x="8"
        y="10"
        width="18"
        height="22"
        rx="2"
        fill="#9AD0FF"
        stroke="#111827"
        strokeWidth="1.6"
      />
      <rect x="13" y="15" width="3.5" height="3.5" fill="#FFFFFF" stroke="#111827" strokeWidth="1.1" />
      <rect x="19" y="15" width="3.5" height="3.5" fill="#7DD3FC" stroke="#111827" strokeWidth="1.1" />
      <rect x="13" y="21" width="3.5" height="3.5" fill="#7DD3FC" stroke="#111827" strokeWidth="1.1" />
      <rect x="19" y="21" width="3.5" height="8" fill="#16A34A" stroke="#111827" strokeWidth="1.1" />
      <path d="M26 14H33V32H26" fill="#E5F0FF" stroke="#111827" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M29.5 18.5H33" stroke="#111827" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M29.5 22.5H33" stroke="#111827" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M29.5 26.5H33" stroke="#111827" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8 32H33" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 10H15" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path
        d="M10.5 5.5L15 10L10.5 14.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ProductCardProps = {
  action: string;
  brand: string;
  description: string;
  href: string;
  icon: ReactNode;
  tags: string[];
  title: string;
  tone: "blue" | "green";
};

function ProductCard({
  action,
  brand,
  description,
  href,
  icon,
  tags,
  title,
  tone,
}: ProductCardProps) {
  const palette =
    tone === "green"
      ? {
          action:
            "bg-[#1FA447] shadow-[0_16px_36px_rgba(31,164,71,0.24)] hover:bg-[#19903d]",
          brand: "text-[#14A44D]",
          iconShell: "bg-[#EAF7EF]",
          pill: "border-[#BDE5CA] bg-[#F4FBF6] text-black/40",
        }
      : {
          action:
            "bg-[#2F61D8] shadow-[0_16px_36px_rgba(47,97,216,0.24)] hover:bg-[#2854be]",
          brand: "text-[#2F61D8]",
          iconShell: "bg-[#EAF1FF]",
          pill: "border-[#B6CDFE] bg-[#F3F7FF] text-black/40",
        };

  return (
    <article className="flex h-full flex-col rounded-[2rem] border border-[#CFE8D8] bg-white/72 p-7 shadow-[0_22px_65px_rgba(83,131,101,0.12)] backdrop-blur-xl sm:p-10">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${palette.iconShell}`}
        >
          {icon}
        </div>
        <div className="pt-0.5">
          <p className={`text-[0.68rem] font-bold uppercase tracking-[0.14em] ${palette.brand}`}>
            {brand}
          </p>
          <h2 className="mt-1 text-[2rem] font-extrabold leading-none tracking-[-0.05em] text-[#2A2A2A]">
            {title}
          </h2>
        </div>
      </div>

      <p className="mt-7 max-w-[20rem] text-[1.05rem] leading-[1.7] tracking-[-0.02em] text-black/48">
        {description}
      </p>

      <div className="mt-7 flex flex-wrap gap-2.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${palette.pill}`}
          >
            {tag}
          </span>
        ))}
      </div>

      <Link
        href={href}
        className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[1.05rem] px-6 py-4 text-lg font-semibold tracking-[-0.03em] text-white transition duration-300 hover:-translate-y-0.5 ${palette.action}`}
      >
        <span>{action}</span>
        <ArrowIcon />
      </Link>
    </article>
  );
}

export default function WelcomePage() {
  return (
    <main className="min-h-screen overflow-hidden p-1.5 sm:p-2">
      <section className="relative mx-auto min-h-[calc(100vh-0.75rem)] max-w-[1920px] overflow-hidden rounded-[1.7rem] border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(241,250,245,0.84)_48%,rgba(229,246,235,0.88))] shadow-[0_28px_90px_rgba(48,94,63,0.08)]">
        <SurfaceBlock className="left-[3%] top-[4.5%] hidden h-[9.5rem] w-[60%] max-w-[64rem] lg:block" />
        <SurfaceBlock className="left-[5%] top-[17%] hidden h-[4.7rem] w-[46%] max-w-[55rem] lg:block" />
        <div
          aria-hidden
          className="absolute left-[7%] top-[31%] hidden h-[26rem] w-[52rem] rounded-[2.25rem] bg-[radial-gradient(circle_at_top_left,rgba(210,245,221,0.62),rgba(230,247,236,0.2)_55%,rgba(255,255,255,0)_80%)] blur-3xl lg:block"
        />
        <div
          aria-hidden
          className="absolute right-[8%] top-[23%] hidden h-[33rem] w-[34rem] overflow-hidden rounded-[2rem] border border-white/30 bg-white/18 shadow-[0_24px_70px_rgba(74,121,90,0.08)] backdrop-blur-[4px] lg:block"
        >
          <div className="grid h-full grid-cols-2 grid-rows-3">
            <div className="border-b border-r border-white/25 bg-[#E8F8ED]/55" />
            <div className="border-b border-white/25 bg-[#E6F5EA]/75" />
            <div className="border-r border-white/25 bg-[#E5F3E8]/65" />
            <div className="bg-[#DFF1E4]/55" />
            <div className="border-r border-t border-white/25 bg-[#EAF6EC]/55" />
            <div className="border-t border-white/25 bg-[#DFF0E3]/65" />
          </div>
        </div>
        <div className="absolute left-[49%] top-[23%] hidden h-10 w-10 rounded-sm bg-white/55 shadow-[0_10px_25px_rgba(255,255,255,0.6)] lg:block" />

        <div className="relative z-10 flex min-h-[calc(100vh-0.75rem)] flex-col px-6 py-8 sm:px-10 sm:py-12 lg:px-20 lg:py-16">
          <motion.div
            {...riseIn(0)}
            className="max-w-[60rem] rounded-[2rem] bg-white/56 px-5 py-5 shadow-[0_18px_60px_rgba(106,149,121,0.06)] backdrop-blur-[2px] sm:px-8 sm:py-7 lg:px-10"
          >
            <h1 className="text-[clamp(3.5rem,7.2vw,6.1rem)] font-black leading-[0.92] tracking-[-0.08em] text-[#222222]">
              İsmayıl Maliyyə Xidmətləri
            </h1>
            <p className="mt-5 max-w-[46rem] text-[clamp(1.35rem,2.3vw,2.2rem)] leading-[1.15] tracking-[-0.05em] text-black/40">
              Portfel idarəetməsi və bank məhsulları — hamısı bir yerdə.
            </p>
          </motion.div>

          <motion.div
            {...riseIn(0.1)}
            className="mt-8 grid max-w-[52rem] gap-6 lg:grid-cols-2"
          >
            <ProductCard
              action="Portfolioma keç"
              brand="İRF"
              description="Şəxsi investisiya portfelinizi real vaxt rejimində izləyin. Aktivlər, gəlirlilik və bölgü — bir baxışda."
              href="/login"
              icon={<PortfolioIcon />}
              tags={["Portfel", "Analitika", "Real vaxt"]}
              title="Rifah Fondu"
              tone="green"
            />
            <ProductCard
              action="İsmayılBanka keç"
              brand="İSMAYILBANK"
              description="Depozit və kredit faizlərini müqayisə edin. Ən sərfəli şərtləri tapın və qərarlarınızı daha ağıllı verin."
              href="/ismayilbank"
              icon={<BankIcon />}
              tags={["Depozit", "Kredit", "Müqayisə"]}
              title="Maliyyə Məhsulları"
              tone="blue"
            />
          </motion.div>

          <motion.p
            {...riseIn(0.22, 16)}
            className="mt-auto pt-10 text-center text-sm tracking-[-0.02em] text-black/28"
          >
            © {new Date().getFullYear()} İsmayıl Süleyman — Bütün hüquqlar qorunur
          </motion.p>
        </div>
      </section>
    </main>
  );
}
