"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isAppRoute } from "@/components/MobileTabBar";
import { ICON_BTN } from "@/components/iconButton";

// Light/dark switching. The initial theme is applied before paint by the
// inline script in app/layout.tsx; these buttons just flip the class and
// persist the choice. Two faces of one control:
//   · ThemeButton — the round header-cluster button on the app pages
//     (fund header, bank header, the calculator's top bar);
//   · ThemeToggle — the floating corner switch, now only for the public
//     pages (welcome / login / portal / register) that have no header
//     cluster to carry it.

function useTheme() {
  // null until mounted so the icon never disagrees with the real class
  // (the server doesn't know the theme).
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private-mode storage failures just mean the choice isn't persisted.
    }
    setDark(next);
  };

  return { dark, toggle };
}

function ThemeIcon({ dark, size }: { dark: boolean | null; size: number }) {
  if (dark === null) return null;
  return dark ? (
    // Sun — shown in dark mode (tap to go light)
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ) : (
    // Moon — shown in light mode (tap to go dark)
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** Header-cluster theme button (the app pages). */
export function ThemeButton() {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "İşıqlı temaya keç" : "Qaranlıq temaya keç"}
      title={dark ? "İşıqlı tema" : "Qaranlıq tema"}
      className={ICON_BTN}
    >
      <ThemeIcon dark={dark} size={16} />
    </button>
  );
}

/** Floating corner switch — public pages only; app pages carry ThemeButton. */
export function ThemeToggle() {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  if (isAppRoute(pathname)) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "İşıqlı temaya keç" : "Qaranlıq temaya keç"}
      className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/55 shadow-glass backdrop-blur-md transition hover:-translate-y-0.5 hover:text-black/85 dark:border-white/15 dark:bg-white/10 dark:text-white/65 dark:hover:text-white/90"
    >
      <ThemeIcon dark={dark} size={18} />
    </button>
  );
}
