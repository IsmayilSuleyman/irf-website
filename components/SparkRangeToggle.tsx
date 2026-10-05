"use client";

import { SPARK_RANGES, type SparkRange } from "@/lib/sparkRanges";

// The row sparklines' window picker (Günlük / Yarımillik / İllik) — the
// CurrencyToggle pill recipe from AllocationList, so it reads as a sibling
// of the ₼/$ toggles beside it. Callers pin it above the sparkline column
// with RowSpark's ABOVE_SPARK.
export function SparkRangeToggle({
  value,
  onChange,
}: {
  value: SparkRange;
  onChange: (r: SparkRange) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Qrafik dövrü"
      className="inline-flex items-center gap-0.5 rounded-full border border-black/10 p-0.5 dark:border-white/15"
    >
      {SPARK_RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          aria-pressed={value === r.key}
          title={r.title}
          // One weight for every state (unlike the single-glyph currency
          // pills): a bolder active word would widen and nudge the group.
          className={`whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide transition ${
            value === r.key
              ? "bg-brand-green/15 text-brand-green dark:text-emerald-400"
              : "text-black/45 hover:text-black/70 dark:text-white/50 dark:hover:text-white/75"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
