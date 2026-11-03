"use client";

import { useState, type ReactNode } from "react";
import { ASSET_ICONS } from "@/components/assetIcons";
import { SectorIcon } from "@/components/SectorIcon";

// Company logos for the Fond Portfeli rows (İsmayıl's ask), loaded from
// Parqet's public logo CDN by ticker. Bitcoin, gold and silver keep the
// app's own marks; a symbol the CDN has no file for (or an odd sheet
// symbol) falls back to the sector glyph chip the rows used before, so the
// list never shows a broken image.

export const LOGO_BASE_URL = "https://assets.parqet.com/logos/symbol";

const OWN_MARKS: Record<string, ReactNode> = {
  IBIT: ASSET_ICONS.btc,
  GLDM: ASSET_ICONS.gold,
  SIVR: ASSET_ICONS.silver,
};

/** The CDN url for a sheet symbol, or null when the symbol can't be one. */
export function holdingLogoUrl(symbol: string): string | null {
  // "BATS:DRAM" → DRAM; "BRK.B" → BRK-B (the CDN's spelling).
  const clean = symbol
    .trim()
    .toUpperCase()
    .replace(/^[A-Z]+:/, "")
    .replace(/\./g, "-");
  if (!/^[A-Z0-9-]{1,10}$/.test(clean)) return null;
  return `${LOGO_BASE_URL}/${clean}?format=png`;
}

export function HoldingLogo({
  symbol,
  sector,
  color,
  isCash = false,
  className = "h-6 w-6",
}: {
  symbol: string;
  sector?: string | null;
  /** The row's pie shade — tints the fallback chip. */
  color?: string;
  isCash?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const key = symbol.trim().toUpperCase();
  const own = OWN_MARKS[key];
  const url = !isCash && !own ? holdingLogoUrl(key) : null;

  const chip = (inner: ReactNode) => (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/60 ${className}`}
      style={color ? { backgroundColor: `${color}26`, color } : undefined}
    >
      {inner}
    </span>
  );

  if (own) return chip(<span className="flex items-center justify-center">{own}</span>);
  if (!url || failed) {
    return chip(<SectorIcon sector={sector ?? ""} className="h-3.5 w-3.5" />);
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-white object-cover ring-1 ring-black/10 dark:ring-white/15 ${className}`}
    />
  );
}
