import type { ExtendedMode } from "@/lib/extendedPortfolio";

// Shared visual identity of the three extended-hours windows: amber sunrise
// (pre), purple sunset (post), blue moon (overnight). Used by the dashboard
// badge and the Fond Portfeli list so the windows always look the same.
// Icon tints are fixed per window — they identify the session, never the
// direction (the numbers carry green/red).
export const EXTENDED_META: Record<
  ExtendedMode,
  { label: string; tooltip: string; iconTint: string; icon: React.ReactNode }
> = {
  pre: {
    label: "Açılışdan əvvəl",
    tooltip: "açılışdan əvvəlki (pre-market) qiymətlərlə",
    iconTint: "text-amber-500 dark:text-amber-400",
    icon: (
      // Sunrise: sun climbing over the horizon.
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 10V3" />
        <path d="m8 7 4-4 4 4" />
        <path d="M4.93 12.93l1.41 1.41" />
        <path d="M2 18h2" />
        <path d="M20 18h2" />
        <path d="m19.07 12.93-1.41 1.41" />
        <path d="M16 18a4 4 0 0 0-8 0" />
        <path d="M22 22H2" />
      </svg>
    ),
  },
  post: {
    label: "Bağlanışdan sonra",
    tooltip: "bağlanışdan sonrakı (after-market) qiymətlərlə",
    iconTint: "text-purple-500 dark:text-purple-400",
    icon: (
      // Sunset: sun sinking toward the horizon.
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3v7" />
        <path d="m8 6 4 4 4-4" />
        <path d="M4.93 12.93l1.41 1.41" />
        <path d="M2 18h2" />
        <path d="M20 18h2" />
        <path d="m19.07 12.93-1.41 1.41" />
        <path d="M16 18a4 4 0 0 0-8 0" />
        <path d="M22 22H2" />
      </svg>
    ),
  },
  overnight: {
    label: "Gecə",
    tooltip: "son bağlanışdan sonrakı (after-market) qiymətlərlə",
    iconTint: "text-blue-500 dark:text-blue-400",
    icon: (
      // Crescent moon.
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79" />
      </svg>
    ),
  },
};
