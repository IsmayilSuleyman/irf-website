"use client";

import { usePrivacy } from "@/components/PrivacyProvider";
import { iconBtn } from "@/components/iconButton";

/**
 * Round eye button that flips hide-amounts mode. `size="header"` renders it
 * in the header cluster's icon-button recipe (lit green while amounts are
 * hidden); the default is the small inline eye used inside cards.
 */
export function PrivacyToggle({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "header";
}) {
  const { hidden, toggle } = usePrivacy();
  const label = hidden ? "Məbləğləri göstər" : "Məbləğləri gizlət";
  const cls =
    size === "header"
      ? iconBtn(hidden)
      : `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-sm transition ${
          hidden
            ? "border-brand-green/40 bg-brand-green/10 text-brand-green dark:text-emerald-400"
            : "border-black/12 bg-white/70 text-black/45 hover:border-brand-green/40 hover:text-brand-green dark:border-white/15 dark:bg-white/5 dark:text-white/50 dark:hover:text-emerald-400"
        }`;
  const iconSize = size === "header" ? 16 : 14;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className={`${cls} ${className ?? ""}`}
    >
      {hidden ? <EyeOffIcon size={iconSize} /> : <EyeIcon size={iconSize} />}
    </button>
  );
}

function EyeIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
