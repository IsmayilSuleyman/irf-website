"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Item = { id: string; label: string };

// Sticky segmented control under the dashboard header for jumping between
// sections of the (very tall) page. One frosted capsule holds all the
// labels; a soft tinted pill slides to the section currently in view.
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
      className="sticky top-[4.2rem] z-30 -mx-6 -mt-6 mb-12 px-6 sm:top-[4.6rem] sm:mb-6"
    >
      <div className="mx-auto max-w-5xl">
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1 py-1.5">
          <div className="inline-flex items-center rounded-full border border-black/5 bg-white/75 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-white/10 dark:bg-white/5">
            {items.map(({ id, label }) => {
              const current = active === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => jump(id)}
                  aria-current={current ? "true" : undefined}
                  className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors duration-200 ${
                    current
                      ? "text-brand-green-deep dark:text-emerald-300"
                      : "text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/75"
                  }`}
                >
                  {current && (
                    <motion.span
                      layoutId="section-nav-pill"
                      className="absolute inset-0 rounded-full bg-brand-green/10 ring-1 ring-inset ring-brand-green/20 dark:bg-emerald-400/15 dark:ring-emerald-400/20"
                      transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
