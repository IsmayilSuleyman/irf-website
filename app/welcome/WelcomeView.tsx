"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { Logo } from "@/components/Logo";
import { IsmayilBankLogo, IsmayilBankMark } from "@/components/IsmayilBankLogo";
import { DEFAULT_TERMS } from "@/lib/bankTermsData";
import { formatGroupedTrim } from "@/lib/portfolio";

// The bank's real top deposit rate, from the same tier table the public
// calculator uses — never a made-up marketing number.
const TOP_DEPOSIT_PCT = formatGroupedTrim(
  Math.max(...DEFAULT_TERMS.deposit.map((t) => t.annualRatePct)),
  1,
);

// The public front door: brand header, a benefit-led hero next to a
// synthetic "inside the portal" preview card, the three product cards and
// a how-it-works strip. Everything here is static demo content — the page
// is public, so no real balances or holders ever render.

const riseIn = (delay: number, y = 22) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const, delay },
});

function ArrowIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
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

/** Static demo sparkline for the preview card — a friendly upward drift. */
function PreviewChart() {
  const line =
    "M0 30 C6 28.5 10 31 15 29 C21 26.5 24 28 29 26 C35 23.5 38 25.5 43 23 " +
    "C48 20.5 52 22.5 57 20 C62 17.5 65 19 70 16 C75 13 80 14.5 85 11.5 " +
    "C90 8.5 95 9.5 99 7";
  return (
    <div className="relative mt-3 text-brand-green dark:text-emerald-400">
      <svg
        viewBox="0 0 100 34"
        preserveAspectRatio="none"
        aria-hidden
        className="h-20 w-full overflow-visible sm:h-24"
      >
        <defs>
          <linearGradient id="welcome-prev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L100 34 L0 34 Z`} fill="url(#welcome-prev)" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx="99" cy="7" r="1.6" fill="currentColor" />
      </svg>
    </div>
  );
}

/** Tiny market chip for the preview card's index row. */
function MiniQuote({ label, pct, up }: { label: string; pct: string; up: boolean }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-black/[0.07] bg-white/70 px-2 py-1 text-[10px] font-medium text-black/55 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
      {label}
      <span
        className={`num font-semibold ${
          up
            ? "text-brand-green dark:text-emerald-400"
            : "text-brand-red dark:text-red-400"
        }`}
      >
        {pct}
      </span>
    </span>
  );
}

/** The hero's right side: what the portal looks like inside, in miniature. */
function PortalPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0">
      {/* No rotation here: a rotated element with backdrop-blur gets
          rasterized into a soft snapshot — the whole card read as blurry
          until hover re-rendered it straight. */}
      <div className="rounded-hero border border-black/10 bg-white/85 p-5 shadow-[0_30px_80px_rgba(48,94,63,0.16)] backdrop-blur-xl dark:border-white/15 dark:bg-white/[0.07] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/45">
            Portalın içi · nümunə
          </span>
          <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold text-brand-green dark:text-emerald-400">
            Canlı
          </span>
        </div>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/45">
          Ümumi balans
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
          <span className="num text-3xl font-extrabold tracking-[-0.03em] text-ink dark:text-white/90 sm:text-4xl">
            12.480,50 ₼
          </span>
          <span className="num rounded-lg border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 text-[11px] font-semibold text-brand-green dark:text-emerald-400">
            +1,9% bu gün
          </span>
        </div>

        <PreviewChart />

        <div className="mt-3 flex flex-wrap gap-1.5">
          <MiniQuote label="S&P 500" pct="+0,4%" up />
          <MiniQuote label="Bitcoin" pct="−1,2%" up={false} />
          <MiniQuote label="Qızıl" pct="+2,4%" up />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-bank-blue/25 bg-bank-blue/[0.06] px-3 py-2.5 dark:border-bank-blue/40 dark:bg-bank-blue/15">
          <span className="flex items-center gap-2 text-[11px] text-black/55 dark:text-white/65">
            <IsmayilBankMark size={13} />
            Depozit illik {TOP_DEPOSIT_PCT}%-dək · kredit bir kliklə
          </span>
          <span className="num text-[11px] font-semibold text-bank-blue dark:text-blue-300">
            +83,20 ₼
          </span>
        </div>
      </div>

      {/* A corner of the bond certificate peeking out from behind — the
          wallet from /bonds, teased. */}
      <div
        aria-hidden
        className="absolute -bottom-12 -left-5 hidden w-44 rotate-[-3deg] rounded-xl border border-white/25 bg-[linear-gradient(135deg,#1e3a8a,#2f61d8)] px-3.5 py-3 text-white shadow-[0_20px_50px_rgba(30,58,138,0.35)] sm:block"
      >
        <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-white/70">
          İsmayılBank İstiqrazı
        </p>
        <p className="num mt-1 text-sm font-bold tracking-[0.06em]">A1 · 2027</p>
        <p className="num mt-0.5 text-[10px] text-white/75">ayda +1,2% kupon</p>
      </div>
    </div>
  );
}

type ProductTone = "green" | "blue" | "cert";

function ProductCard({
  brand,
  title,
  description,
  href,
  action,
  tone,
  visual,
}: {
  brand: string;
  title: string;
  description: string;
  href: string;
  action: string;
  tone: ProductTone;
  visual?: React.ReactNode;
}) {
  const link =
    tone === "blue"
      ? "text-bank-blue dark:text-blue-400"
      : "text-brand-green dark:text-emerald-400";
  const brandTone =
    tone === "blue"
      ? "text-bank-blue dark:text-blue-400"
      : "text-brand-green dark:text-emerald-400";
  return (
    <article className="group flex h-full flex-col rounded-hero border border-black/10 bg-white/75 p-6 shadow-[0_18px_55px_rgba(83,131,101,0.10)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(83,131,101,0.16)] dark:border-white/12 dark:bg-white/[0.07] sm:p-7">
      {visual}
      <p className={`mt-5 text-[10px] font-bold uppercase tracking-[0.2em] ${brandTone}`}>
        {brand}
      </p>
      <h2 className="mt-1.5 text-xl font-extrabold tracking-[-0.03em] text-ink dark:text-white/90 sm:text-2xl">
        {title}
      </h2>
      <p className="mt-2.5 text-sm leading-6 text-black/50 dark:text-white/55">
        {description}
      </p>
      <Link
        href={href}
        className={`mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold ${link}`}
      >
        <span>{action}</span>
        <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </article>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-green/30 bg-brand-green/10 text-sm font-bold text-brand-green dark:text-emerald-400">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink dark:text-white/90">{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-black/50 dark:text-white/55">
          {text}
        </p>
      </div>
    </div>
  );
}

export function WelcomeView({
  showSetupNotice,
  year,
}: {
  showSetupNotice: boolean;
  year: number;
}) {
  return (
    <div className="relative z-10 mx-auto flex min-h-[calc(100vh-0.75rem)] max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
      {/* Brand header: both houses on the left, the door on the right. */}
      <m.header
        {...riseIn(0.02, 14)}
        className="flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Logo width={120} priority />
          <span
            className="hidden h-6 w-px bg-black/15 dark:bg-white/20 min-[430px]:block"
            aria-hidden
          />
          <span className="hidden min-[430px]:block">
            <IsmayilBankLogo size={22} />
          </span>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(22,163,74,0.24)] transition duration-300 hover:-translate-y-0.5 hover:bg-brand-green-deep"
        >
          <span>Daxil ol</span>
          <ArrowIcon />
        </Link>
      </m.header>

      {showSetupNotice ? (
        <m.div
          {...riseIn(0.05, 12)}
          className="mt-6 rounded-2xl border border-bank-blue-ring bg-white/80 px-5 py-4 backdrop-blur-md dark:border-bank-blue/40 dark:bg-white/10"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
            Qurasdirma xetasi
          </p>
          <p className="mt-2 text-sm leading-6 text-black/55 dark:text-white/60">
            Supabase ayarlari Vercel-de tam qurasdirilmayib. Buna gore giris
            hissesi mueqqeti olaraq deaktivdir. `NEXT_PUBLIC_SUPABASE_URL` ve
            `NEXT_PUBLIC_SUPABASE_ANON_KEY` deyerlerini Vercel project
            settings-e elave etdikden sonra portal yeniden ishleyecek.
          </p>
        </m.div>
      ) : null}

      {/* Hero: promise on the left, the product itself on the right. */}
      <div className="mt-10 grid items-center gap-10 sm:mt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <m.div {...riseIn(0.08)}>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-green/80 dark:text-emerald-400/80">
            İsmayıl Maliyyə Xidmətləri
          </p>
          <h1 className="mt-3 text-[clamp(2.6rem,5.6vw,4.3rem)] font-black leading-[1.02] tracking-[-0.05em] text-ink dark:text-white/95">
            Ailənin öz fondu,
            <br />
            öz bankı.
          </h1>
          <p className="mt-5 max-w-[34rem] text-[clamp(1.05rem,1.5vw,1.25rem)] leading-[1.6] text-black/50 dark:text-white/55">
            İRF paylarınızı canlı qiymətlərlə izləyin, İsmayılBank-da depozit
            və kredit şərtlərinizi idarə edin, istiqraz alın — hamısı bir
            girişlə.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-green px-6 py-3.5 text-base font-semibold text-white shadow-[0_16px_36px_rgba(22,163,74,0.24)] transition duration-300 hover:-translate-y-0.5 hover:bg-brand-green-deep"
            >
              <span>Portala daxil ol</span>
              <ArrowIcon />
            </Link>
            <Link
              href="/ismayilbank"
              className="inline-flex items-center gap-2 rounded-2xl border border-black/15 bg-white/60 px-6 py-3.5 text-base font-semibold text-black/70 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-bank-blue/50 hover:text-bank-blue dark:border-white/20 dark:bg-white/10 dark:text-white/75 dark:hover:text-blue-300"
            >
              Kalkulyatoru sına
            </Link>
          </div>
        </m.div>

        <m.div {...riseIn(0.16)}>
          <PortalPreview />
        </m.div>
      </div>

      {/* The three houses. */}
      <m.div
        {...riseIn(0.24)}
        className="mt-14 grid gap-4 sm:mt-20 md:grid-cols-3"
      >
        <ProductCard
          brand="İRF"
          title="İnvestisiya portfeli"
          description="Pay dəyəriniz, mənfəət-zərər zolaqları və alış-satış nişanları ilə tam tarixçə — hər gün qeyd olunan fond qiyməti üzərində."
          href="/login"
          action="Portfolioma keç"
          tone="green"
          visual={
            <div className="inline-flex w-fit rounded-card border border-brand-green-ring bg-white/90 px-4 py-3 dark:border-brand-green/30 dark:bg-white/10">
              <Logo width={132} />
            </div>
          }
        />
        <ProductCard
          brand="İsmayılBank"
          title="Depozit və kredit"
          description={`İllik ${TOP_DEPOSIT_PCT}%-dək depozit, sərfəli kredit şərtləri və hesablaşmaların şəffaf cədvəli. Kalkulyator girişsiz də işləyir.`}
          href="/ismayilbank"
          action="Kalkulyatoru aç"
          tone="blue"
          visual={
            <div className="inline-flex w-fit rounded-card border border-blue-200/70 bg-white/90 px-4 py-3 dark:border-blue-400/25 dark:bg-white/10">
              <IsmayilBankLogo size={30} />
            </div>
          }
        />
        <ProductCard
          brand="İstiqrazlar"
          title="Aylıq kupon gəliri"
          description="Fiziki sertifikat görünüşlü İsmayılBank istiqrazları: sabit aylıq kupon, buraxılış seriyaları və ikinci bazar — portalın içində."
          href="/bonds"
          action="Seriyalara bax"
          tone="cert"
          visual={
            <div
              aria-hidden
              className="w-fit rounded-xl border border-white/25 bg-[linear-gradient(135deg,#1e3a8a,#2f61d8)] px-3.5 py-2.5 text-white shadow-[0_14px_34px_rgba(30,58,138,0.3)]"
            >
              <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-white/70">
                İsmayılBank İstiqrazı
              </p>
              <p className="num mt-0.5 text-sm font-bold tracking-[0.06em]">
                A1 · 2027
              </p>
            </div>
          }
        />
      </m.div>

      {/* One login, three steps. */}
      <m.div
        {...riseIn(0.3)}
        className="mt-4 rounded-hero border border-black/10 bg-white/70 p-6 backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.06] sm:p-7"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40 dark:text-white/45">
          Necə işləyir
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <Step
            n="1"
            title="Daxil ol"
            text="Bir hesabla həm İRF portfeliniz, həm İsmayılBank hesabınız açılır."
          />
          <Step
            n="2"
            title="Balansını gör"
            text="Paylar, depozitlər, istiqrazlar və digər aktivlər — bir səhifədə, canlı."
          />
          <Step
            n="3"
            title="Gündəlik mükafatını götür"
            text="Hər gün portala bax, 0,10 ₼ üzvlük mükafatın depozitinə əlavə olunsun."
          />
        </div>
      </m.div>

      <m.p
        {...riseIn(0.36, 14)}
        className="mt-auto pt-10 text-center text-[13px] tracking-[-0.01em] text-black/30 dark:text-white/35"
      >
        © {year} İsmayıl Süleyman. Bütün hüquqlar qorunur.
      </m.p>
    </div>
  );
}
