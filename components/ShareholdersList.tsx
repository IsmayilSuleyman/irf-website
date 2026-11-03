"use client";

import { useState } from "react";
import { formatAzn, formatPct } from "@/lib/portfolio";
import { initialsOf, toTitleCaseAz } from "@/lib/user";
import { Masked } from "@/components/Masked";
import { IsmayilBankMark } from "@/components/IsmayilBankLogo";
import { CollapseBody } from "@/components/Collapsible";
import type { AssetHolderSummary } from "@/lib/personalAssets";

type Shareholder = {
  name: string;
  valueAzn: number;
  percent: number;
  /** Profile photo (a Google-linked login) — initials otherwise. */
  avatarUrl?: string | null;
};

// A round avatar per holder: the Google profile picture when the login has
// one, the holder's initials in a green ring otherwise (İsmayıl's ask).
function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        aria-hidden
        referrerPolicy="no-referrer"
        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/15"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-[9px] font-bold tracking-[0.04em] text-brand-green dark:bg-emerald-400/10 dark:text-emerald-400"
    >
      {initialsOf(name)}
    </span>
  );
}

function HolderRow({
  name,
  valueAzn,
  pct,
  avatarUrl,
}: {
  name: string;
  valueAzn: number;
  pct: number;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={name} url={avatarUrl} />
        <span className="min-w-0 truncate text-black/70 dark:text-white/75">
          {toTitleCaseAz(name)}
        </span>
      </span>
      <span className="flex shrink-0 items-baseline gap-2">
        <span className="num font-medium text-black dark:text-white/90">
          <Masked>{formatAzn(valueAzn)}</Masked>
        </span>
        <span className="num w-12 text-right text-[10px] text-black/45 dark:text-white/50">
          <Masked mask="••">{formatPct(pct)}</Masked>
        </span>
      </span>
    </div>
  );
}

/**
 * Whole-fund view, one card: every shareholder's slice of the Fund, then —
 * when the Aktivlər ledger has rows — the personal-ETF holders beneath it
 * (their books live outside the fund, at İsmayılBank as a non-interest,
 * untouchable reserve; the logo line says who provides it). That second
 * list opens on tap — collapsed by default, it is a footnote to the fund's
 * own holders. Amounts respect hide-amounts mode.
 */
export function ShareholdersList({
  holders,
  assetHolders = [],
}: {
  holders: Shareholder[];
  assetHolders?: AssetHolderSummary[];
}) {
  const [othersOpen, setOthersOpen] = useState(false);
  const sorted = [...holders]
    .filter((h) => h.valueAzn > 0)
    .sort((a, b) => b.valueAzn - a.valueAzn);
  const assetRows = assetHolders.filter((h) => h.valueAzn > 0);
  const assetTotal = assetRows.reduce((s, h) => s + h.valueAzn, 0);

  return (
    <div className="glass flex flex-col gap-2.5 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
        Pay sahibləri
      </div>
      {sorted.length === 0 ? (
        <div className="text-[13px] text-black/45 dark:text-white/50">
          Sahib yoxdur.
        </div>
      ) : (
        <div className="flex max-h-80 flex-col divide-y divide-[color:var(--glass-border)] overflow-y-auto pr-1 text-[13px]">
          {sorted.map((h, i) => (
            <HolderRow
              key={`${h.name}-${i}`}
              name={h.name}
              valueAzn={h.valueAzn}
              pct={h.percent}
              avatarUrl={h.avatarUrl}
            />
          ))}
        </div>
      )}

      {assetRows.length > 0 && (
        <div className="mt-1 border-t border-[color:var(--glass-border)] pt-2.5">
          <button
            type="button"
            onClick={() => setOthersOpen((o) => !o)}
            aria-expanded={othersOpen}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="text-[10px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[11px]">
              Digər aktivlər sahibləri · {assetRows.length}
            </span>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 shrink-0 fill-none stroke-current text-black/45 transition-transform dark:text-white/50 ${
                othersOpen ? "rotate-180" : ""
              }`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <CollapseBody open={othersOpen}>
            <div className="flex flex-col divide-y divide-[color:var(--glass-border)] pt-1.5 text-[13px]">
              {assetRows.map((h, i) => (
                <HolderRow
                  key={`${h.name}-${i}`}
                  name={h.name}
                  valueAzn={h.valueAzn}
                  pct={assetTotal > 0 ? h.valueAzn / assetTotal : 0}
                />
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[10px] leading-relaxed text-black/45 dark:text-white/50">
              <IsmayilBankMark size={13} />
              Məlumat İsmayılBank tərəfindən təqdim olunur.
            </p>
          </CollapseBody>
        </div>
      )}
    </div>
  );
}
