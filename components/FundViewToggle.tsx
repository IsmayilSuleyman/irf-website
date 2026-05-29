"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * Owner-only switch that flips the dashboard between the personal-holding view
 * and the whole-fund view. The view is encoded in the URL (`?view=fund`) so the
 * server component re-renders with the right data and the state survives
 * refreshes and is shareable. The dashboard has no other query params, so
 * toggling off simply clears the search string.
 *
 * `compact` renders a shrunken version that fits inline on the greeting row
 * (used on mobile); the default size is used in the desktop header row.
 */
export function FundViewToggle({
  active,
  compact = false,
  className,
}: {
  active: boolean;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    router.push(active ? pathname : `${pathname}?view=fund`, { scroll: false });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label="Ümumfond baxışı"
      onClick={toggle}
      className={`group inline-flex shrink-0 items-center ${
        compact ? "gap-1.5" : "gap-2.5 px-1 py-1"
      } ${className ?? ""}`}
    >
      <span
        className={`font-semibold uppercase transition-colors ${
          compact
            ? "text-[8px] tracking-[0.14em]"
            : "text-[9px] tracking-[0.2em] sm:text-[10px]"
        } ${active ? "text-brand-green" : "text-black/45 group-hover:text-black/70"}`}
      >
        Ümumfond baxış
      </span>
      <span
        className={`relative inline-flex shrink-0 items-center rounded-full transition-colors ${
          compact ? "h-3.5 w-6" : "h-5 w-9"
        } ${active ? "bg-brand-green" : "bg-black/15 group-hover:bg-black/25"}`}
      >
        <span
          className={`inline-block rounded-full bg-white shadow-sm transition-transform ${
            compact ? "h-2.5 w-2.5" : "h-4 w-4"
          } ${
            active
              ? compact
                ? "translate-x-[11px]"
                : "translate-x-[18px]"
              : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
