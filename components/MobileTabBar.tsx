"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Bottom tab bar shown on phones (hidden ≥sm) for the authenticated app
// area, mirroring native banking apps. Rendered once in the root layout;
// hides itself on public pages (welcome/login/portal) where the header
// links already cover navigation.

export function isAppRoute(pathname: string): boolean {
  return ["/dashboard", "/market", "/bank", "/bonds", "/ismayilbank"].some((p) =>
    pathname.startsWith(p),
  );
}

const TABS = [
  {
    href: "/dashboard",
    label: "Portfel",
    isActive: (p: string) => p.startsWith("/dashboard"),
    active: "text-brand-green dark:text-emerald-400",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M15 8h5v5" />
      </svg>
    ),
  },
  {
    href: "/market",
    label: "Bazar",
    isActive: (p: string) => p.startsWith("/market"),
    active: "text-brand-green dark:text-emerald-400",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4v16m0-16L3 8m4-4 4 4" />
        <path d="M17 20V4m0 16 4-4m-4 4-4-4" />
      </svg>
    ),
  },
  {
    href: "/bank",
    label: "Bank",
    isActive: (p: string) => p.startsWith("/bank") || p.startsWith("/ismayilbank"),
    active: "text-bank-blue dark:text-blue-400",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5 12 4l9 5.5" />
        <path d="M5 10v8m4.5-8v8m5-8v8M19 10v8" />
        <path d="M3 20h18" />
      </svg>
    ),
  },
  {
    href: "/bonds",
    label: "İstiqraz",
    isActive: (p: string) => p.startsWith("/bonds"),
    active: "text-bank-blue dark:text-blue-400",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h4" />
        <circle cx="16" cy="16.5" r="1.6" />
      </svg>
    ),
  },
];

export function MobileTabBar() {
  const pathname = usePathname();
  if (!isAppRoute(pathname)) return null;

  return (
    <>
      {/* In-flow spacer so page content can scroll clear of the fixed bar. */}
      <div aria-hidden className="h-20 sm:hidden" />
      <nav
        aria-label="Əsas naviqasiya"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-white/15 dark:bg-black/60 sm:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {TABS.map((tab) => {
            const current = tab.isActive(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                  current
                    ? tab.active
                    : "text-black/45 dark:text-white/50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
