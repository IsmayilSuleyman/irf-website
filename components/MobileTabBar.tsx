"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// The phone dock (hidden ≥sm), rendered once in the root layout: a floating
// Leobank-style glass pill (İsmayıl's reference) instead of the old edge-
// to-edge tab bar. Two docks, chosen by the route — idea "124":
//   · Rifah Fondu pages: Portfelim · Bazar · Fond, where Fond opens the
//     Ümumfond view (?view=fund) — the view switch that used to sit at the
//     top of the dashboard lives here now;
//   · İsmayılBank pages: Hesabım · Hesabla · İstiqraz, in the bank's blue;
//     the way back to the fund is the round İRF button in the bank header.
// It hides itself on public pages (welcome/login/portal). An external member
// (lib/access.ts) has no Portfel: the gated pages mark themselves with
// data-access-scope="external" and globals.css hides the /dashboard links
// via :has() — the layout itself never reads the session (that would put a
// token refresh on every public page).

export function isAppRoute(pathname: string): boolean {
  return ["/dashboard", "/market", "/bank", "/bonds", "/ismayilbank"].some((p) =>
    pathname.startsWith(p),
  );
}

export function isBankRoute(pathname: string): boolean {
  return ["/bank", "/bonds", "/ismayilbank"].some((p) => pathname.startsWith(p));
}

type Tab = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  isActive: (pathname: string, view: string | null) => boolean;
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FUND_TABS: Tab[] = [
  {
    key: "portfelim",
    href: "/dashboard",
    label: "Portfelim",
    isActive: (p, view) => p.startsWith("/dashboard") && view !== "fund",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden>
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M15 8h5v5" />
      </svg>
    ),
  },
  {
    key: "bazar",
    href: "/market",
    label: "Bazar",
    isActive: (p) => p.startsWith("/market"),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden>
        <path d="M7 4v16m0-16L3 8m4-4 4 4" />
        <path d="M17 20V4m0 16 4-4m-4 4-4-4" />
      </svg>
    ),
  },
  {
    key: "fond",
    href: "/dashboard?view=fund",
    label: "Fond",
    isActive: (p, view) => p.startsWith("/dashboard") && view === "fund",
    // The fund's own cross mark — green on transparent, both themes.
    icon: (
      <img
        src="/images/irf-mark.png"
        alt=""
        aria-hidden
        className="h-5 w-5"
      />
    ),
  },
];

const BANK_TABS: Tab[] = [
  {
    key: "hesabim",
    href: "/bank",
    label: "Hesabım",
    isActive: (p) => p.startsWith("/bank"),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden>
        <path d="M3 9.5 12 4l9 5.5" />
        <path d="M5 10v8m4.5-8v8m5-8v8M19 10v8" />
        <path d="M3 20h18" />
      </svg>
    ),
  },
  {
    key: "hesabla",
    href: "/ismayilbank",
    label: "Hesabla",
    isActive: (p) => p.startsWith("/ismayilbank"),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01M8 19h6" />
      </svg>
    ),
  },
  {
    key: "istiqraz",
    href: "/bonds",
    label: "İstiqraz",
    isActive: (p) => p.startsWith("/bonds"),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h4" />
        <circle cx="16" cy="16.5" r="1.6" />
      </svg>
    ),
  },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!isAppRoute(pathname)) return null;

  const bank = isBankRoute(pathname);
  const tabs = bank ? BANK_TABS : FUND_TABS;
  const view = searchParams.get("view");
  const activeTone = bank
    ? "text-bank-blue dark:text-blue-400"
    : "text-brand-green dark:text-emerald-400";

  return (
    <>
      {/* In-flow spacer so page content can scroll clear of the floating dock. */}
      <div aria-hidden className="h-24 sm:hidden" />
      <nav
        aria-label="Əsas naviqasiya"
        data-tone={bank ? "bank" : "fund"}
        className="mobile-tab-bar glass-dock fixed inset-x-3.5 bottom-[calc(env(safe-area-inset-bottom)+0.875rem)] z-40 flex h-16 items-stretch gap-0.5 rounded-full p-1.5 sm:hidden"
      >
        {tabs.map((tab) => {
          const current = tab.isActive(pathname, view);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={`relative z-[1] flex flex-1 flex-col items-center justify-center gap-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                current
                  ? `${activeTone} bg-[var(--dock-on)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_2px_10px_rgba(0,0,0,0.08)]`
                  : "text-black/45 dark:text-white/50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
