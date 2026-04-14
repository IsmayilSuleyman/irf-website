"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";
import { Logo } from "@/components/Logo";

const riseIn = (delay: number, y = 24) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const, delay },
});

function GlassLayer({
  className,
  style,
}: {
  className: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`absolute border border-white/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.34),rgba(255,255,255,0.1))] shadow-[0_24px_70px_rgba(74,121,90,0.08)] backdrop-blur-[16px] ${className}`}
      style={style}
    />
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
  headerVisual?: ReactNode;
  href: string;
  icon?: ReactNode;
  tags: string[];
  title?: string;
  tone: "blue" | "green";
};

function ProductCard({
  action,
  brand,
  description,
  headerVisual,
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
      {headerVisual ? (
        <div>
          {headerVisual}
          {title ? (
            <h2 className="mt-5 text-[2rem] font-extrabold leading-none tracking-[-0.05em] text-[#2A2A2A]">
              {title}
            </h2>
          ) : null}
        </div>
      ) : (
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
      )}

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
      <section className="relative mx-auto min-h-[calc(100vh-0.75rem)] max-w-[1920px] overflow-hidden rounded-[1.7rem] border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.8),rgba(242,250,245,0.88)_48%,rgba(229,246,235,0.9))] shadow-[0_28px_90px_rgba(48,94,63,0.08)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(255,255,255,0.76),rgba(255,255,255,0)_30%),radial-gradient(circle_at_74%_78%,rgba(205,244,219,0.54),rgba(205,244,219,0)_26%)]"
        />
        <GlassLayer className="left-[2.5%] top-[4.5%] hidden h-[9rem] w-[58rem] rounded-full lg:block" />
        <GlassLayer className="left-[5.5%] top-[17.5%] hidden h-[4.75rem] w-[34rem] rounded-full lg:block" />
        <div
          aria-hidden
          className="absolute left-[4%] top-[29%] hidden h-[25rem] w-[54rem] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(214,245,223,0.76),rgba(214,245,223,0.2)_48%,rgba(255,255,255,0)_76%)] blur-3xl lg:block"
        />
        <GlassLayer
          className="right-[6%] top-[18%] hidden h-[35rem] w-[36rem] lg:block"
          style={{
            borderRadius: "42% 58% 53% 47% / 39% 43% 57% 61%",
            transform: "rotate(-11deg)",
          }}
        />
        <div
          aria-hidden
          className="absolute right-[8%] top-[20%] hidden h-[31rem] w-[31rem] rounded-full border border-white/30 bg-[radial-gradient(circle_at_28%_28%,rgba(255,255,255,0.58),rgba(255,255,255,0.08)_54%,rgba(255,255,255,0)_72%)] shadow-[0_18px_60px_rgba(92,132,106,0.08)] backdrop-blur-md lg:block"
        />
        <GlassLayer
          className="right-[11%] top-[28%] hidden h-[14rem] w-[27rem] rounded-full lg:block"
          style={{ transform: "rotate(15deg)" }}
        />
        <div
          aria-hidden
          className="absolute right-[13%] bottom-[11%] hidden h-[9rem] w-[9rem] rounded-full border border-white/25 bg-white/22 shadow-[0_18px_50px_rgba(101,144,118,0.08)] backdrop-blur-md lg:block"
        />
        <div
          aria-hidden
          className="absolute left-[50%] top-[22%] hidden h-11 w-11 rounded-full border border-white/40 bg-white/42 shadow-[0_10px_25px_rgba(255,255,255,0.6)] backdrop-blur-md lg:block"
        />

        <div className="relative z-10 flex min-h-[calc(100vh-0.75rem)] flex-col px-6 py-8 sm:px-10 sm:py-12 lg:px-20 lg:py-16">
          <motion.div
            {...riseIn(0)}
            className="max-w-[60rem] rounded-[2.25rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.62),rgba(255,255,255,0.34))] px-5 py-5 shadow-[0_18px_60px_rgba(106,149,121,0.06)] backdrop-blur-[10px] sm:px-8 sm:py-7 lg:px-10"
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
              headerVisual={
                <div className="inline-flex rounded-[1.2rem] border border-[#BDE5CA] bg-white/88 px-4 py-3 shadow-[0_16px_38px_rgba(31,164,71,0.12)]">
                  <div className="w-[180px] sm:w-[210px]">
                    <Logo width={210} priority />
                  </div>
                </div>
              }
              href="/login"
              tags={["Portfel", "Analitika", "Real vaxt"]}
              tone="green"
            />
            <ProductCard
              action="İsmayılBanka keç"
              brand="İSMAYILBANK"
              description="Depozit və kredit faizlərini müqayisə edin. Ən sərfəli şərtləri tapın və qərarlarınızı daha ağıllı verin."
              headerVisual={
                <div className="inline-flex rounded-[1.2rem] border border-blue-200/70 bg-white/88 px-4 py-3 shadow-[0_16px_38px_rgba(66,96,175,0.12)]">
                  <IsmayilBankLogo size={38} />
                </div>
              }
              href="/ismayilbank"
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
