"use client";

import { useState, type ReactNode } from "react";

// Generic card-section disclosure: collapsed, a single centered pill button;
// open, the children plus a quieter "Daha az" control. The children are
// rendered on the server either way — this only toggles what is shown, and a
// fragment return lets them participate in the parent's flex gap directly.
export function ShowMore({
  moreLabel = "Daha çox",
  lessLabel = "Daha az",
  children,
}: {
  moreLabel?: string;
  lessLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mx-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/5 px-4 py-1.5 text-[11px] font-medium text-brand-green shadow-sm transition hover:bg-brand-green/10 dark:text-emerald-400"
      >
        <span>{moreLabel}</span>
        <span aria-hidden className="transition group-hover:translate-y-0.5">
          ↓
        </span>
      </button>
    );
  }
  return (
    <>
      {children}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mx-auto w-fit text-[11px] text-black/50 transition-colors hover:text-black/80 dark:text-white/55 dark:hover:text-white/85"
      >
        {lessLabel} ↑
      </button>
    </>
  );
}
