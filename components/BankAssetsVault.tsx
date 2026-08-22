"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "framer-motion";
import { Masked } from "@/components/Masked";
import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import type { AssetPosition } from "@/lib/personalAssets";

/** A purchasable asset the holder does NOT own yet — shown on the podium as
 *  an invitation. */
export type VaultInvite = {
  symbol: string;
  label: string;
  iconKey: string | null;
  dayChangePct: number | null;
};

// The holder's valuables on a vault podium: the ETF book (gold / silver /
// BTC / S&P) plus the İRF holding — one item takes the stage at a time
// (big disc, slow coin-spin, neighbors at the sides) with its figures
// beneath. NOTHING here enters the deposit balance or the bank's lendable
// funding; the card says so in plain words, because that's the whole
// arrangement. İRF gets its own note and a Bazar button — pays are the
// fund's product, traded on /market, not a bank deposit.

const fmtPct = (p: number) =>
  `${p >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(p) * 100, 2)}%`;

type VaultItem = {
  key: string;
  label: string;
  symbol: string | null;
  iconKey: string | null;
  valueAzn: number | null;
  dayChangePct: number | null;
  totalPnlAzn: number | null;
  isIrf: boolean;
  /** false = an invitation: the holder doesn't own this yet. */
  owned: boolean;
};

/** Stage-sized asset marks (the shared ASSET_ICONS are 12px chips). */
function assetGlyph(iconKey: string | null, size: "stage" | "side"): ReactNode {
  const cls =
    size === "stage"
      ? "h-16 w-16 text-black/60 dark:text-white/75"
      : "h-6 w-6 text-black/45 dark:text-white/55";
  switch (iconKey) {
    case "irf":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/irf-mark.png"
          alt=""
          aria-hidden
          className={size === "stage" ? "h-16 w-16 object-contain" : "h-6 w-6 object-contain"}
        />
      );
    case "sp500":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 17l5-5 4 4 8-8" />
          <path d="M15 8h5v5" />
        </svg>
      );
    case "btc":
      return (
        <span
          aria-hidden
          className={`font-bold leading-none text-black/60 dark:text-white/75 ${
            size === "stage" ? "text-6xl" : "text-xl"
          }`}
        >
          ₿
        </span>
      );
    case "gold":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
          <path d="M9 5h6l2.4 4.5H6.6L9 5Z" />
          <path d="M6.5 12.5h11L20 18H4l2.5-5.5Z" />
        </svg>
      );
    case "silver":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
          <path d="M9 5h6l2.4 4.5H6.6L9 5Z" />
          <path d="M6.5 12.5h11L20 18H4l2.5-5.5Z" />
        </svg>
      );
    default:
      return (
        <span aria-hidden className={size === "stage" ? "text-4xl" : "text-base"}>
          ◆
        </span>
      );
  }
}

// Turntable motion: the incoming exhibit slides in from the direction of
// travel while the outgoing one leaves the other way, slightly shrunk — the
// stage rotating, not a hard swap.
const stageVariants = {
  enter: (d: number) => ({ opacity: 0, x: d * 48, scale: 0.72 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (d: number) => ({ opacity: 0, x: d * -48, scale: 0.72 }),
};

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M12.5 4.5L7 10l5.5 5.5" : "M7.5 4.5L13 10l-5.5 5.5"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BankAssetsVault({
  positions,
  unowned = [],
  irfValueAzn = 0,
}: {
  positions: AssetPosition[];
  /** Purchasable assets the holder does NOT own — podium invitations. */
  unowned?: VaultInvite[];
  /** The holder's İRF pay value — podium item with its own not-a-deposit note. */
  irfValueAzn?: number;
}) {
  // Order: what you own first, then İRF, then the invitations.
  const items: VaultItem[] = [
    ...positions.map((p) => ({
      key: p.symbol,
      label: p.label,
      symbol: p.symbol,
      iconKey: p.iconKey,
      valueAzn: p.valueAzn,
      dayChangePct: p.dayChangePct,
      totalPnlAzn: p.totalPnlAzn,
      isIrf: false,
      owned: true,
    })),
    {
      key: "irf",
      label: "İRF Payı",
      symbol: null,
      iconKey: "irf",
      valueAzn: irfValueAzn,
      dayChangePct: null,
      totalPnlAzn: null,
      isIrf: true,
      owned: irfValueAzn > 0,
    },
    ...unowned.map((a) => ({
      key: a.symbol,
      label: a.label,
      symbol: a.symbol,
      iconKey: a.iconKey,
      valueAzn: null,
      dayChangePct: a.dayChangePct,
      totalPnlAzn: null,
      isIrf: false,
      owned: false,
    })),
  ];
  const [idx, setIdx] = useState(0);
  // Direction of the last turn (+1 next, −1 prev) — drives which side the
  // incoming exhibit enters from.
  const [dir, setDir] = useState(1);
  const n = items.length;
  const at = (i: number) => items[((i % n) + n) % n];
  const norm = (i: number) => ((i % n) + n) % n;
  const go = (d: number) => {
    setDir(d);
    setIdx((i) => i + d);
  };
  const goTo = (i: number) => {
    setDir(i >= norm(idx) ? 1 : -1);
    setIdx(i);
  };
  if (n === 0) return null;
  const active = at(idx);
  const prev = at(idx - 1);
  const next = at(idx + 1);
  const etfTotalAzn = positions.reduce((s, p) => s + (p.valueAzn ?? 0), 0);

  return (
    <div className="rounded-hero border border-black/10 bg-white/90 p-6 dark:border-white/10 dark:bg-white/10 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
          Aktivlərim
        </p>
        <p className="text-[11px] text-black/45 dark:text-white/50">
          İsmayılBank seyfində saxlanılır
        </p>
      </div>

      {/* The podium: neighbors wait at the sides, the star spins slowly on
          stage. Arrows and side discs both rotate the turntable. */}
      <div className="mt-5 flex items-center justify-center gap-3 sm:gap-5">
        {n > 1 ? (
          <button
            type="button"
            aria-label="Əvvəlki aktiv"
            onClick={() => go(-1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/50 transition hover:border-bank-blue/40 hover:text-bank-blue dark:border-white/15 dark:text-white/55 dark:hover:text-blue-300"
          >
            <Arrow dir="left" />
          </button>
        ) : null}

        {n > 2 ? (
          <button
            type="button"
            aria-label={prev.label}
            onClick={() => go(-1)}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black/[0.05] opacity-70 transition hover:opacity-100 dark:bg-white/[0.07]"
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={prev.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {assetGlyph(prev.iconKey, "side")}
              </m.span>
            </AnimatePresence>
          </button>
        ) : null}

        <div className="flex flex-col items-center">
          {/* Invitations get a dashed ring and a dimmed mark — clearly an
              empty pedestal waiting for its exhibit. */}
          <div
            className={`flex h-40 w-40 items-center justify-center overflow-hidden rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_18px_40px_rgba(0,0,0,0.12)] transition-colors duration-300 sm:h-44 sm:w-44 ${
              active.owned
                ? "bg-black/[0.06] dark:bg-white/[0.08]"
                : "border-2 border-dashed border-black/15 bg-black/[0.03] dark:border-white/20 dark:bg-white/[0.04]"
            }`}
          >
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <m.div
                key={active.key}
                custom={dir}
                variants={stageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className={`vault-spin [transform-style:preserve-3d] ${
                    active.owned ? "" : "opacity-50"
                  }`}
                >
                  {assetGlyph(active.iconKey, "stage")}
                </div>
              </m.div>
            </AnimatePresence>
          </div>
          {/* The podium base: a squashed shadow grounding the disc. */}
          <div
            aria-hidden
            className="-mt-1 h-3 w-28 rounded-[50%] bg-black/15 blur-[6px] dark:bg-black/45 sm:w-32"
          />
        </div>

        {n > 2 ? (
          <button
            type="button"
            aria-label={next.label}
            onClick={() => go(1)}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black/[0.05] opacity-70 transition hover:opacity-100 dark:bg-white/[0.07]"
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={next.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {assetGlyph(next.iconKey, "side")}
              </m.span>
            </AnimatePresence>
          </button>
        ) : null}

        {n > 1 ? (
          <button
            type="button"
            aria-label="Növbəti aktiv"
            onClick={() => go(1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/50 transition hover:border-bank-blue/40 hover:text-bank-blue dark:border-white/15 dark:text-white/55 dark:hover:text-blue-300"
          >
            <Arrow dir="right" />
          </button>
        ) : null}
      </div>

      {/* The star's plaque — fades through with the exhibit; the dots stay
          put outside the animated region. */}
      <div className="mt-4 text-center">
        <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={active.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
        {!active.owned ? (
          <p className="mb-1.5">
            <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-green dark:text-emerald-400">
              Almaq mümkündür
            </span>
          </p>
        ) : null}
        <p className="text-lg font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
          {active.label}
        </p>
        <p className="num mt-1 text-3xl font-bold tracking-[-0.02em] text-ink dark:text-white/95">
          {active.owned ? (
            active.valueAzn != null ? (
              <Masked mask="•••• ₼">{formatAzn(active.valueAzn)}</Masked>
            ) : (
              "—"
            )
          ) : (
            <Masked mask="•••• ₼">{formatAzn(0)}</Masked>
          )}
        </p>
        <p className="mt-1.5 flex items-center justify-center gap-3 text-[12px]">
          {active.dayChangePct != null ? (
            <span
              className={`num font-semibold ${
                active.dayChangePct >= 0
                  ? "text-brand-green dark:text-emerald-400"
                  : "text-brand-red dark:text-red-400"
              }`}
            >
              {fmtPct(active.dayChangePct)} bu gün
            </span>
          ) : null}
          {active.totalPnlAzn != null && active.totalPnlAzn !== 0 ? (
            <span
              className={`num ${
                active.totalPnlAzn >= 0
                  ? "text-brand-green dark:text-emerald-400"
                  : "text-brand-red dark:text-red-400"
              }`}
            >
              <Masked mask="••••">
                {`${active.totalPnlAzn >= 0 ? "+" : "−"}${formatAzn(Math.abs(active.totalPnlAzn))} ümumi`}
              </Masked>
            </span>
          ) : null}
        </p>

        {active.isIrf ? (
          <div className="mt-3 flex flex-col items-center gap-2.5">
            <p className="max-w-sm text-[11px] leading-5 text-black/45 dark:text-white/50">
              İRF payları İsmayılBank depoziti deyil — fondun öz payıdır və
              bank balansından kənarda saxlanılır.
            </p>
            <Link
              href="/market"
              className="inline-flex items-center gap-1.5 rounded-xl bg-bank-blue px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-bank-blue-deep"
            >
              Bazara keç — pay al
            </Link>
          </div>
        ) : !active.owned ? (
          <p className="mx-auto mt-3 max-w-sm text-[11px] leading-5 text-black/45 dark:text-white/50">
            Bu aktivi 1 ₼-dən başlayaraq, komissiyasız ala bilərsən — almaq
            üçün İsmayıl ilə əlaqə saxla, seyfə buradan düşəcək.
          </p>
        ) : null}
        </m.div>
        </AnimatePresence>

        {n > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {items.map((it, i) => (
              <button
                key={it.key}
                type="button"
                aria-label={it.label}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === ((idx % n) + n) % n
                    ? "w-5 bg-bank-blue dark:bg-blue-400"
                    : "w-1.5 bg-black/20 hover:bg-black/35 dark:bg-white/25 dark:hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {positions.length > 0 ? (
        <p className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-black/[0.06] pt-3 text-[12px] dark:border-white/10">
          <span className="text-black/50 dark:text-white/55">
            Seyfdəki digər aktivlər (cəmi)
          </span>
          <span className="num font-semibold text-ink dark:text-white/90">
            <Masked mask="•••• ₼">{formatAzn(etfTotalAzn)}</Masked>
          </span>
        </p>
      ) : null}
      <p className="mt-2 text-[11px] leading-5 text-black/45 dark:text-white/50">
        Buradakı heç nə depozit balansına daxil deyil və faiz qazanmır —
        bankın seyfində sizin adınıza ayrıca saxlanılır. Digər aktivləri
        almaq və ya satmaq üçün İsmayıl ilə əlaqə saxlayın.
      </p>
    </div>
  );
}
