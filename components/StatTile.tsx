import { ReactNode } from "react";

export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-brand-green"
      : tone === "negative"
        ? "text-brand-red"
        : "text-black";

  return (
    <div className="glass flex flex-col gap-2 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        {label}
      </div>
      <div className={`num text-4xl md:text-5xl font-bold ${toneClass}`}>
        {value}
      </div>
      {sub && (
        <div className="text-xs text-black/40 leading-snug max-w-xs">{sub}</div>
      )}
    </div>
  );
}
