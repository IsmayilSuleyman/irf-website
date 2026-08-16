import type { ReactNode } from "react";

// Tiny asset marks shared by the ticker strip's tiles and the Aktivlərim
// card — inline SVGs/glyphs only, kept to the site's palette (brand green
// for the market/brand marks, the muted gray scale for the rest); shape
// does the distinguishing. Keys match lib/marketTicker's instrument keys.
export const ASSET_ICONS: Record<string, ReactNode> = {
  sp500: (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-brand-green dark:text-emerald-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 17l5-5 4 4 8-8" />
      <path d="M15 8h5v5" />
    </svg>
  ),
  btc: (
    <span
      aria-hidden
      className="shrink-0 text-[11px] font-bold leading-none text-black/55 dark:text-white/60"
    >
      ₿
    </span>
  ),
  // Bullion bars — a small ingot stacked on a big one. Gold is the filled
  // stack, silver the outlined one; both stay in the site's gray scale.
  gold: (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-black/45 dark:text-white/55"
      fill="currentColor"
      aria-hidden
    >
      <path d="M9 5h6l2.4 4.5H6.6L9 5Z" />
      <path d="M6.5 12.5h11L20 18H4l2.5-5.5Z" />
    </svg>
  ),
  silver: (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-black/45 dark:text-white/55"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 5h6l2.4 4.5H6.6L9 5Z" />
      <path d="M6.5 12.5h11L20 18H4l2.5-5.5Z" />
    </svg>
  ),
  oil: (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-black/45 dark:text-white/50"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.7c3.2 3.9 6 7.4 6 10.8a6 6 0 1 1-12 0c0-3.4 2.8-6.9 6-10.8Z" />
    </svg>
  ),
  // The fund's real cross mark, cropped square from the logo artwork
  // (public/images/irf-mark.png) — green on transparent, works in both
  // themes without the wordmark's dark-mode invert.
  irf: (
    <img
      src="/images/irf-mark.png"
      alt=""
      aria-hidden
      className="h-3.5 w-3.5 shrink-0"
    />
  ),
};
