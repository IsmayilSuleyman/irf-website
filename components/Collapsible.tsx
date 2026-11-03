"use client";

import { useEffect, useState, type ReactNode } from "react";

// "Optionally hide-able" cards (İsmayıl's ask for Borclar, İnvestisiya
// siyasəti and Satış siqnalları): a Gizlət / Göstər pill in the card's
// header row folds the body away, and the choice is remembered per device
// in localStorage — like the hide-amounts eye, but without a cookie round
// trip. SSR renders every card open; a remembered "closed" applies right
// after hydration. The body stays mounted (a native grid-rows collapse,
// the AllocationList recipe), so reopening costs no mount work.

export function useRememberedOpen(storageKey: string): [boolean, () => void] {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === "0") setOpen(false);
    } catch {
      // Private window / blocked storage: the card simply opens.
    }
  }, [storageKey]);

  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // Not persisted — the next visit opens it again.
      }
      return next;
    });

  return [open, toggle];
}

export function CollapseButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 transition hover:text-black/75 dark:border-white/15 dark:text-white/50 dark:hover:text-white/80"
    >
      {open ? "Gizlət" : "Göstər"}
      <svg
        aria-hidden
        viewBox="0 0 10 6"
        className={`h-1.5 w-2.5 fill-none stroke-current transition-transform ${
          open ? "rotate-180" : ""
        }`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m1 1 4 4 4-4" />
      </svg>
    </button>
  );
}

export function CollapseBody({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      inert={!open || undefined}
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * A glass card whose body folds behind a Gizlət / Göstər pill. The header
 * row (title left, optional aside + the pill right) always shows; the body
 * takes the card's gap once open. Server components pass their content as
 * children — only the fold is client state.
 */
export function CollapsibleCard({
  storageKey,
  title,
  aside,
  children,
  className,
}: {
  storageKey: string;
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, toggle] = useRememberedOpen(storageKey);
  return (
    <div className={`glass p-6 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        {title}
        <div className="flex shrink-0 items-center gap-3">
          {aside}
          <CollapseButton open={open} onClick={toggle} />
        </div>
      </div>
      <CollapseBody open={open}>
        <div className="flex flex-col gap-6 pt-6">{children}</div>
      </CollapseBody>
    </div>
  );
}
