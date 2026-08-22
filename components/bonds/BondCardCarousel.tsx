"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "framer-motion";
import { formatGrouped, formatGroupedTrim, formatUnits } from "@/lib/portfolio";
import type { BondSeries } from "@/lib/bonds";

// "Mənim istiqrazlarım" as a wallet of physical certificate cards — one
// banknote-proportioned card per owned series, swiped (touch) or stepped
// (arrows/dots) left and right. Each card carries the series' whole story:
// the holding's nominal value, the coupon terms and what they pay per month,
// and an expiry track running from issue to maturity — a bond is a card that
// EXPIRES but keeps earning until it does. Card art cycles per series so
// different buraxılışlar read as different editions.

const MS_DAY = 86_400_000;

type Theme = {
  /** Card face gradient. */
  face: string;
  /** Large soft glow orb, top-right. */
  glow: string;
  /** Accent text on dark art (rates, earnings). */
  accent: string;
};

const THEMES: Theme[] = [
  {
    face: "bg-[linear-gradient(135deg,#2b55c4_0%,#1d3d92_55%,#142a68_100%)]",
    glow: "bg-sky-400/30",
    accent: "text-sky-200",
  },
  {
    face: "bg-[linear-gradient(135deg,#12855c_0%,#0d6647_55%,#094a34_100%)]",
    glow: "bg-emerald-300/25",
    accent: "text-emerald-200",
  },
  {
    face: "bg-[linear-gradient(135deg,#6d3fc4_0%,#53309c_55%,#3b2270_100%)]",
    glow: "bg-fuchsia-300/25",
    accent: "text-fuchsia-200",
  },
  {
    face: "bg-[linear-gradient(135deg,#b06a10_0%,#8f540b_55%,#6b3e08_100%)]",
    glow: "bg-amber-300/25",
    accent: "text-amber-200",
  },
];

// Matured/cancelled series keep their slot in the wallet but lose the live
// colors — a settled certificate reads as archived, not active.
const SETTLED_THEME: Theme = {
  face: "bg-[linear-gradient(135deg,#565d6b_0%,#414855_55%,#30353f_100%)]",
  glow: "bg-white/15",
  accent: "text-white/70",
};

// Hydration-safe Azerbaijani date labels — no Intl in a client component
// (the repo's hydration rule; same recipe as PerformanceChart). Series dates
// are YYYY-MM-DD, parsed as UTC midnight, so UTC parts are the calendar day.
const AZ_MONTHS_SHORT = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avq", "sen", "okt", "noy", "dek",
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.valueOf())) return value;
  return `${d.getUTCDate()} ${AZ_MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function CertificateCard({
  series,
  theme,
  nowMs,
}: {
  series: BondSeries;
  theme: Theme;
  nowMs: number;
}) {
  const owned = series.my_units > 0;
  const holdingAzn = series.my_units * series.face_value_azn;
  const monthlyAzn =
    (holdingAzn * series.coupon_rate_pct) / 100 / 12;
  const couponPerPeriodAzn =
    (holdingAzn * series.coupon_rate_pct / 100) *
    (series.coupon_period_months / 12);
  // Unowned cards sell the terms instead of a holding: what ONE unit pays.
  const perUnitMonthlyAzn =
    (series.face_value_azn * series.coupon_rate_pct) / 100 / 12;
  const perUnitCouponAzn =
    ((series.face_value_azn * series.coupon_rate_pct) / 100) *
    (series.coupon_period_months / 12);

  const issueMs = new Date(series.issue_date).getTime();
  const maturityMs = new Date(series.maturity_date).getTime();
  const spanOk =
    Number.isFinite(issueMs) && Number.isFinite(maturityMs) && maturityMs > issueMs;
  const elapsedPct = spanOk
    ? Math.min(100, Math.max(0, ((nowMs - issueMs) / (maturityMs - issueMs)) * 100))
    : 0;
  const daysLeft = Number.isFinite(maturityMs)
    ? Math.max(0, Math.ceil((maturityMs - nowMs) / MS_DAY))
    : null;

  const active = series.status === "active";
  const statusLabel =
    series.status === "active"
      ? daysLeft != null && daysLeft > 0
        ? `${formatGrouped(daysLeft, 0)} gün qalıb`
        : "Bitir"
      : series.status === "matured"
        ? "Ödənilib"
        : "Ləğv edilib";

  return (
    <div
      className={`relative aspect-[1.6/1] w-full overflow-hidden rounded-2xl ${theme.face} p-5 text-white shadow-[0_24px_50px_-20px_rgba(10,25,60,0.55)] sm:p-6`}
    >
      {/* Card art: a soft glow orb, a fine diagonal engraving, a giant
          watermark ₼ and an inner certificate frame — all decorative. */}
      <div aria-hidden className={`absolute -right-14 -top-16 h-48 w-48 rounded-full blur-2xl ${theme.glow}`} />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 7px)",
        }}
      />
      <div aria-hidden className="num pointer-events-none absolute -bottom-10 -right-2 select-none text-[10rem] font-black leading-none text-white/[0.06]">
        ₼
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-2 rounded-xl border border-white/15" />
      {/* Ownership stamp: unowned series carry a rubber-stamp mark across
          the face so a browsable card can never be mistaken for a holding. */}
      {!owned ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="-rotate-12 rounded-lg border-2 border-white/35 px-4 py-1.5 text-[13px] font-black uppercase tracking-[0.3em] text-white/40">
            Sizdə yoxdur
          </span>
        </div>
      ) : null}

      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/65">
            İsmayılBank · İstiqraz sertifikatı
          </p>
          <span
            className={`num shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tabular-nums ${
              active ? "bg-white/15 text-white" : "bg-black/25 text-white/75"
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-2.5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-[-0.02em] sm:text-xl">
              {series.name}
            </p>
            <p className="mt-0.5 text-[11px] text-white/60">
              {owned ? (
                <>
                  <span className="num">{formatUnits(series.my_units)}</span> ədəd ×{" "}
                  <span className="num">{formatGrouped(series.face_value_azn, 2)}</span> ₼ nominal
                </>
              ) : (
                <>
                  1 ədədin nominalı ·{" "}
                  <span className="num">{formatUnits(series.primary_available)}</span> ədəd
                  buraxılışda
                </>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="num text-[1.7rem] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[2rem]">
              {formatGrouped(owned ? holdingAzn : series.face_value_azn, 2)}
              <span className="ml-0.5 text-[1rem] font-medium text-white/60">₼</span>
            </p>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
          <span className={`num rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold tabular-nums ${theme.accent}`}>
            illik {formatGroupedTrim(series.coupon_rate_pct, 2)}%
          </span>
          <span className="num rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white/80">
            hər {series.coupon_period_months} ay kupon
          </span>
          {active && owned && monthlyAzn > 0 ? (
            <span className="num rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-emerald-200">
              ayda +{formatGrouped(monthlyAzn, 2)} ₼
            </span>
          ) : null}
          {active && !owned && perUnitMonthlyAzn > 0 ? (
            <span className="num rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-emerald-200">
              1 ədəd → ayda +{formatGrouped(perUnitMonthlyAzn, 2)} ₼
            </span>
          ) : null}
        </div>

        {/* Life track: issue → maturity. The fill is how much of the card's
            life has burned; the certificate "expires" where it ends. */}
        <div className="mt-3">
          <div className="flex h-1 w-full overflow-hidden rounded-full bg-white/20" aria-hidden>
            <span className="h-full rounded-full bg-white/90" style={{ width: `${elapsedPct}%` }} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[10px] text-white/60">
            <span>Buraxılış {formatDate(series.issue_date)}</span>
            <span>
              Bitmə{" "}
              <span className="font-semibold text-white/85">
                {formatDate(series.maturity_date)}
              </span>
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-[10px] text-white/55">
            <span>
              {active && series.next_coupon_date ? (
                <>
                  Növbəti kupon {formatDate(series.next_coupon_date)}
                  {owned && couponPerPeriodAzn > 0 ? (
                    <span className="num"> · +{formatGrouped(couponPerPeriodAzn, 2)} ₼</span>
                  ) : null}
                  {!owned && perUnitCouponAzn > 0 ? (
                    <span className="num">
                      {" "}· +{formatGrouped(perUnitCouponAzn, 2)} ₼ / ədəd
                    </span>
                  ) : null}
                </>
              ) : (
                "Kupon ödənişləri bitib"
              )}
            </span>
            <span className="num uppercase tracking-[0.14em]">
              № {series.id.slice(0, 8)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Arrow({
  side,
  onClick,
  label,
}: {
  side: "left" | "right";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/55 shadow-sm backdrop-blur transition hover:text-black/85 dark:border-white/15 dark:bg-black/40 dark:text-white/60 dark:hover:text-white/85 ${
        side === "left" ? "-left-3 sm:-left-4" : "-right-3 sm:-right-4"
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 8 12"
        className={`h-3 w-2 fill-none stroke-current ${side === "left" ? "" : "rotate-180"}`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 1 1.5 6l5 5" />
      </svg>
    </button>
  );
}

const SLIDE_VARIANTS = {
  enter: (d: number) => ({ opacity: 0, x: 56 * d, scale: 0.96 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (d: number) => ({ opacity: 0, x: -56 * d, scale: 0.96 }),
};

export function BondCardCarousel({
  series,
  nowMs,
}: {
  /** Owned series first, then unowned active ones as browsable cards —
   *  the page decides the ordering. */
  series: BondSeries[];
  /** Server render time — passed down so SSR and hydration agree on day math. */
  nowMs: number;
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const touchX = useRef<number | null>(null);

  if (series.length === 0) return null;

  const clamped = Math.min(index, series.length - 1);
  const active = series[clamped];
  // Wallet totals count only what the viewer actually holds.
  const ownedCount = series.filter((x) => x.my_units > 0).length;
  const totalNominalAzn = series.reduce(
    (s, x) => s + x.my_units * x.face_value_azn,
    0,
  );
  const totalMonthlyAzn = series.reduce(
    (s, x) =>
      s +
      (x.status === "active"
        ? (x.my_units * x.face_value_azn * x.coupon_rate_pct) / 100 / 12
        : 0),
    0,
  );

  const go = (delta: number) => {
    setDir(delta > 0 ? 1 : -1);
    setIndex((i) => (i + delta + series.length) % series.length);
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bank-blue dark:text-blue-400">
            {ownedCount > 0 ? "Mənim istiqrazlarım" : "İstiqraz seriyaları"}
          </p>
          {ownedCount > 0 ? (
            <p className="mt-1 text-[13px] text-black/55 dark:text-white/60">
              <span className="num font-semibold text-ink dark:text-white/90">
                {formatGrouped(totalNominalAzn, 2)} ₼
              </span>{" "}
              nominal · {ownedCount} seriya sizdə
              {totalMonthlyAzn > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="num font-semibold text-status-paid dark:text-emerald-400">
                    ayda +{formatGrouped(totalMonthlyAzn, 2)} ₼
                  </span>
                </>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-black/55 dark:text-white/60">
              Hələ istiqrazınız yoxdur — kartlara baxın, bəyəndiyiniz seriya ilə
              ticarətə keçin.
            </p>
          )}
        </div>
        {active ? (
          <Link
            // Hash target so the click always lands on the trading section —
            // without it, picking the already-selected series changed nothing
            // visible and the link read as dead.
            href={`/bonds?s=${active.id}#ticaret`}
            className="text-[11px] font-semibold text-bank-blue transition hover:text-bank-blue-deep dark:text-blue-400 dark:hover:text-blue-300"
          >
            Bu seriya ilə ticarət →
          </Link>
        ) : null}
      </div>

      <div className="relative mx-auto mt-4 max-w-[430px]">
        <div
          // Touch swipe: a >40px horizontal move steps the wallet. Manual
          // handlers instead of framer drag — the app's LazyMotion bundle
          // ships domAnimation only (no drag features), and a step-swipe is
          // all a wallet needs.
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            const end = e.changedTouches[0]?.clientX;
            if (start == null || end == null || series.length < 2) return;
            const dx = end - start;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
          <AnimatePresence initial={false} mode="wait" custom={dir}>
            <m.div
              key={active.id}
              custom={dir}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <CertificateCard
                series={active}
                theme={
                  active.status === "active"
                    ? THEMES[clamped % THEMES.length]
                    : SETTLED_THEME
                }
                nowMs={nowMs}
              />
            </m.div>
          </AnimatePresence>
        </div>
        {series.length > 1 ? (
          <>
            <Arrow side="left" onClick={() => go(-1)} label="Əvvəlki seriya" />
            <Arrow side="right" onClick={() => go(1)} label="Növbəti seriya" />
          </>
        ) : null}
      </div>

      {series.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {series.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={s.name}
              aria-current={i === clamped}
              onClick={() => {
                setDir(i > clamped ? 1 : -1);
                setIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === clamped
                  ? "w-4 bg-bank-blue dark:bg-blue-400"
                  : "w-1.5 bg-black/15 hover:bg-black/30 dark:bg-white/20 dark:hover:bg-white/35"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
