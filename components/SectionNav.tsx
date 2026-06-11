"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string };

// Sticky chip row under the dashboard header for jumping between sections
// of the (very tall) page. Highlights the section currently in view.
export function SectionNav({ items }: { items: Item[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const key = items.map((i) => i.id).join(",");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Consider a section "active" while it occupies the upper-middle band
      // of the viewport (below the sticky chrome, above the fold).
      { rootMargin: "-25% 0px -60% 0px" },
    );
    for (const { id } of items) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="Səhifə bölmələri"
      className="sticky top-[4.2rem] z-30 -mx-6 -mt-6 mb-6 px-6 sm:top-[4.6rem]"
    >
      <div className="mx-auto max-w-5xl">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1.5">
          {items.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => jump(id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur-md transition ${
                active === id
                  ? "border-brand-green/40 bg-brand-green text-white shadow-glass-green dark:border-emerald-400/40"
                  : "border-black/10 bg-white/80 text-black/55 hover:text-black/85 dark:border-white/15 dark:bg-white/10 dark:text-white/60 dark:hover:text-white/90"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
