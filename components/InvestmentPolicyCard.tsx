import { Masked } from "@/components/Masked";
import { SectorIcon } from "@/components/SectorIcon";
import { sectorColor } from "@/lib/sectorColors";
import { formatAzn, formatGrouped } from "@/lib/portfolio";
import {
  POLICY,
  evaluateCashRule,
  formatPolicyDate,
  type PolicyReport,
  type SleeveRow,
} from "@/lib/investmentPolicy";
import {
  isExtremeFear,
  type FearGreed,
  type MarketSignals,
} from "@/lib/marketSignals";

// The Investment Policy card: live sleeve allocation against the written
// targets/caps, the rule violations that demand action, the 6-month unwind
// schedule and the §4 dip-buying trigger. Server component — everything is
// computed upstream (lib/investmentPolicy) and rendered as facts; the only
// client behavior is <Masked> honoring the hide-amounts eye.

// Bars share one scale so widths are comparable across sleeves: 50% of the
// portfolio = full track width (the largest limit is the 40% ETF floor).
const BAR_SCALE = 0.5;

const pct1 = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;
const pct0 = (fraction: number): string => `${Math.round(fraction * 100)}%`;

function fearGreedZoneAz(fg: FearGreed): string {
  const r = fg.rating.toLowerCase();
  if (r.includes("extreme fear")) return "İfrat qorxu";
  if (r.includes("extreme greed")) return "İfrat hərislik";
  if (r.includes("fear")) return "Qorxu";
  if (r.includes("greed")) return "Hərislik";
  if (r.includes("neutral")) return "Neytral";
  // Rating missing — fall back to CNN's score bands.
  if (fg.score <= 25) return "İfrat qorxu";
  if (fg.score <= 45) return "Qorxu";
  if (fg.score <= 55) return "Neytral";
  if (fg.score <= 75) return "Hərislik";
  return "İfrat hərislik";
}

function SleeveBar({ row }: { row: SleeveRow }) {
  const color = sectorColor(row.label);
  const fillPct = Math.min(1, row.actualPct / BAR_SCALE) * 100;
  const tickPct = Math.min(1, row.limit / BAR_SCALE) * 100;
  const fillCls =
    row.status === "trim"
      ? "bg-brand-red"
      : row.status === "over" || row.status === "under"
        ? "bg-amber-500"
        : "bg-brand-green";
  const note =
    row.status === "trim" ? (
      <span className="text-brand-red dark:text-red-400">
        satılmalı: <Masked mask="••••">{formatAzn(row.deltaAzn)}</Masked>
      </span>
    ) : row.status === "over" ? (
      <span className="text-amber-600 dark:text-amber-400">
        limitdən artıq: <Masked mask="••••">{formatAzn(row.deltaAzn)}</Masked>
      </span>
    ) : row.status === "under" ? (
      <span className="text-amber-600 dark:text-amber-400">
        hədəfə çatmır: <Masked mask="••••">{formatAzn(row.deltaAzn)}</Masked>
      </span>
    ) : null;

  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${color}26`, color }}
          >
            <SectorIcon sector={row.label} className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-sm text-black/85 dark:text-white/90">
            {row.label}
          </span>
        </div>
        <div className="num shrink-0 text-sm text-black/70 dark:text-white/75">
          <span className="font-semibold text-black/85 dark:text-white/90">
            {pct1(row.actualPct)}
          </span>
          <span className="ml-1.5 text-black/45 dark:text-white/50">
            / {row.kind === "floor" ? "min" : "maks"} {pct0(row.limit)}
          </span>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full bg-black/5 dark:bg-white/10">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${fillCls}`}
          style={{ width: `${fillPct}%` }}
        />
        {/* The limit tick: floor to reach, or cap not to cross. */}
        <div
          aria-hidden
          className="absolute -top-[3px] h-3 w-px bg-black/35 dark:bg-white/55"
          style={{ left: `${tickPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="num text-black/45 dark:text-white/50">
          <Masked mask="••••">{formatAzn(row.valueAzn)}</Masked>
        </span>
        {note && <span className="num">{note}</span>}
      </div>
    </li>
  );
}

function ActionRow({
  when,
  tone = "neutral",
  children,
}: {
  when: string;
  tone?: "neutral" | "positive" | "negative" | "warn";
  children: React.ReactNode;
}) {
  const badgeCls =
    tone === "negative"
      ? "bg-red-500/10 text-brand-red dark:text-red-400"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : tone === "positive"
          ? "bg-brand-green/10 text-brand-green dark:text-emerald-400"
          : "bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/75";
  return (
    <li className="flex items-start gap-3 py-2">
      <span
        className={`num mt-0.5 min-w-[64px] shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-medium ${badgeCls}`}
      >
        {when}
      </span>
      <span className="text-[13px] leading-snug text-black/70 dark:text-white/75">
        {children}
      </span>
    </li>
  );
}

export function InvestmentPolicyCard({
  report,
  signals,
}: {
  report: PolicyReport;
  signals: MarketSignals;
}) {
  if (report.totalAzn <= 0) return null;

  const cashRule = evaluateCashRule(report, {
    extremeFear: isExtremeFear(signals.fearGreed),
    drawdown: signals.sp500?.drawdown ?? null,
  });

  // §3 quarterly trims: capped sleeves >2pp over. The stocks sleeve is
  // excluded while the §6 unwind schedule owns it, and cash is excluded
  // because §4 handles cash excess immediately, not quarterly.
  const ratchetTrims = report.sleeves.filter(
    (s) =>
      s.status === "trim" &&
      s.sleeve !== "cash" &&
      (s.sleeve !== "stocks" || report.unwind.finished),
  );

  const nextUnwind = report.unwind.schedule.find((m) => m.status === "next");
  const unwindActive = report.unwind.excessAzn > 0 && !report.unwind.finished;

  const fg = signals.fearGreed;
  const sp = signals.sp500;

  return (
    <div className="glass flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          İnvestisiya Siyasəti
        </div>
        <div className="text-[11px] text-black/45 dark:text-white/50">
          Qüvvədə: {formatPolicyDate(POLICY.effectiveDate)}
        </div>
      </div>

      {/* §1 — sleeves against their floor/caps */}
      <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        {report.sleeves.map((row) => (
          <SleeveBar key={row.sleeve} row={row} />
        ))}
      </ul>

      {/* Rule-driven to-dos, chronological */}
      <div className="border-t border-[color:var(--glass-border)] pt-4">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          Növbəti addımlar
        </div>
        <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
          {cashRule.state === "deploy" && (
            <ActionRow when="Bu ay" tone="positive">
              Dib-alış triggeri aktivdir — nağdın 1/3-i,{" "}
              <Masked mask="••••">{formatAzn(cashRule.monthlyAzn)}</Masked>,
              Geniş bazar ETF-inə yatırılır.
            </ActionRow>
          )}
          {cashRule.state === "excess" && (
            <ActionRow when="İndi" tone="warn">
              Nağd {pct0(POLICY.sleeves.cash.limit)} limitini aşır və trigger
              aktiv deyil — artıq{" "}
              <Masked mask="••••">{formatAzn(cashRule.excessAzn)}</Masked>{" "}
              Geniş bazar ETF-inə yatırılmalıdır (qayda pozuntusu).
            </ActionRow>
          )}
          <ActionRow
            when={formatPolicyDate(report.nextContribution, "short")}
            tone="positive"
          >
            Növbəti töhfə günü (maaş ay sonu, borclar 10-dək).{" "}
            {report.broadEtfBelowFloor
              ? "Hədəflərə çatana qədər töhfənin 100%-i Geniş bazar ETF-inə."
              : "Hədəflər yerindədir — bölgü ETF ≥ 40% şərti ilə aparıla bilər."}{" "}
            Məbləğ Qorxu-Hərislik pilləli cədvəli ilə.
          </ActionRow>
          {unwindActive && nextUnwind && (
            <ActionRow
              when={formatPolicyDate(nextUnwind.date, "short")}
              tone="negative"
            >
              Azaltma satışı: fərdi səhmlərdən{" "}
              <Masked mask="••••">
                {formatAzn(report.unwind.monthlySellAzn)}
              </Masked>{" "}
              (artıqlığın 1/{report.unwind.monthsRemaining}-i) bazar əmri ilə
              satılır; gəlir ETF 40%-ə çatanadək ETF-ə.
            </ActionRow>
          )}
          {report.breaches.map((b) => (
            <ActionRow
              key={b.symbol || b.name}
              when={
                nextUnwind
                  ? formatPolicyDate(nextUnwind.date, "short")
                  : "İndi"
              }
              tone="negative"
            >
              {(b.symbol || b.name).toUpperCase()} portfelin {pct1(b.pct)}
              -idir — tək mövqe limiti {pct0(POLICY.singleNameCap)}. Artıq
              hissə (<Masked mask="••••">{formatAzn(b.excessAzn)}</Masked>)
              satış növbəsində birincidir.
            </ActionRow>
          ))}
          {ratchetTrims.length > 0 && (
            <ActionRow
              when={formatPolicyDate(report.nextQuarterCheck, "short")}
              tone="negative"
            >
              Rüblük yoxlama:{" "}
              {ratchetTrims.map((s, i) => (
                <span key={s.sleeve}>
                  {i > 0 && ", "}
                  {s.label} (satılmalı:{" "}
                  <Masked mask="••••">{formatAzn(s.deltaAzn)}</Masked>)
                </span>
              ))}{" "}
              — limiti 2 bənddən çox aşır; artıq hissə satılıb Geniş bazar
              ETF-inə köçürülür.
            </ActionRow>
          )}
        </ul>
      </div>

      {/* §6 — the six-month unwind */}
      <div className="border-t border-[color:var(--glass-border)] pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
            6 aylıq azaltma qrafiki
          </div>
          <div className="text-[11px] text-black/45 dark:text-white/50">
            sen 2026 – fev 2027
          </div>
        </div>
        {report.unwind.finished ? (
          <div className="text-[13px] text-black/55 dark:text-white/60">
            Qrafik başa çatıb — fərdi səhmlər bundan sonra rüblük ratçetlə
            idarə olunur.
          </div>
        ) : report.unwind.excessAzn <= 0 ? (
          <div className="text-[13px] text-black/55 dark:text-white/60">
            Fərdi səhmlər {pct0(POLICY.sleeves.stocks.limit)} həddi
            daxilindədir — azaltma satışı tələb olunmur.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="num text-[13px] text-black/70 dark:text-white/75">
              Cari artıqlıq:{" "}
              <Masked mask="••••">
                {formatAzn(report.unwind.excessAzn)}
              </Masked>{" "}
              <span className="text-black/45 dark:text-white/50">
                · aylıq satış ≈{" "}
              </span>
              <Masked mask="••••">
                {formatAzn(report.unwind.monthlySellAzn)}
              </Masked>{" "}
              <span className="text-black/45 dark:text-white/50">
                · qalan {report.unwind.monthsRemaining} ay
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.unwind.schedule.map((m) => (
                <span
                  key={m.date}
                  className={`num rounded-lg border px-2.5 py-1 text-[11px] ${
                    m.status === "past"
                      ? "border-transparent bg-black/5 text-black/45 dark:bg-white/10 dark:text-white/50"
                      : m.status === "next"
                        ? "border-brand-green/40 bg-brand-green/5 font-medium text-brand-green dark:text-emerald-400"
                        : "border-[color:var(--glass-border)] text-black/70 dark:text-white/75"
                  }`}
                >
                  {formatPolicyDate(m.date, "short")}
                </span>
              ))}
            </div>
            <div className="text-[11px] leading-snug text-black/45 dark:text-white/50">
              Hər ayın ilk ticarət günü, bazar əmri ilə — bərpa, hesabat və ya
              xəbər gözlənilmir; səhmə inam satışı təxirə salmaq üçün səbəb
              deyil.
            </div>
          </div>
        )}
      </div>

      {/* §4 — market signals feeding the dip-buying trigger */}
      <div className="border-t border-[color:var(--glass-border)] pt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          Bazar siqnalları
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5 rounded-xl border border-[color:var(--glass-border)] p-3">
            <div className="text-[11px] text-black/45 dark:text-white/50">
              CNN Qorxu-Hərislik indeksi
            </div>
            {fg ? (
              <div className="flex items-baseline gap-2">
                <span className="num text-2xl font-bold text-black dark:text-white/90">
                  {fg.score}
                </span>
                <span
                  className={`text-xs ${
                    isExtremeFear(fg)
                      ? "font-medium text-brand-green dark:text-emerald-400"
                      : "text-black/55 dark:text-white/60"
                  }`}
                >
                  {fearGreedZoneAz(fg)}
                </span>
              </div>
            ) : (
              <div className="text-sm text-black/45 dark:text-white/50">
                əlçatan deyil
              </div>
            )}
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl border border-[color:var(--glass-border)] p-3">
            <div className="text-[11px] text-black/45 dark:text-white/50">
              S&amp;P 500 tarixi zirvədən
            </div>
            {sp ? (
              <div className="flex items-baseline gap-2">
                <span
                  className={`num text-2xl font-bold ${
                    sp.drawdown <= POLICY.cashDeployDrawdown
                      ? "text-brand-green dark:text-emerald-400"
                      : "text-black dark:text-white/90"
                  }`}
                >
                  {sp.drawdown >= 0
                    ? "0.0%"
                    : `−${(-sp.drawdown * 100).toFixed(1)}%`}
                </span>
                <span className="num text-xs text-black/45 dark:text-white/50">
                  {formatGrouped(sp.price, 0)} / zirvə{" "}
                  {formatGrouped(sp.allTimeHigh, 0)}
                </span>
              </div>
            ) : (
              <div className="text-sm text-black/45 dark:text-white/50">
                əlçatan deyil
              </div>
            )}
          </div>
        </div>
        <div
          className={`mt-2 text-[12px] leading-snug ${
            cashRule.state === "deploy"
              ? "font-medium text-brand-green dark:text-emerald-400"
              : "text-black/45 dark:text-white/50"
          }`}
        >
          {cashRule.state === "deploy"
            ? `Dib-alış triggeri aktivdir (${[
                cashRule.reasons.includes("fear") ? "İfrat qorxu" : null,
                cashRule.reasons.includes("drawdown")
                  ? "S&P zirvədən ≥15% aşağı"
                  : null,
              ]
                .filter(Boolean)
                .join(" + ")}) — hər ay nağdın 1/3-i ETF-ə.`
            : cashRule.state === "unknown"
              ? "Siqnallar hazırda əlçatan deyil — trigger qiymətləndirilməyib."
              : "Dib-alış triggeri deaktivdir: İfrat qorxu yoxdur və S&P zirvədən 15%-dən az aralıdadır. Nağd yalnız yeni töhfələrlə yığılır — heç vaxt satışla yox."}
        </div>
      </div>

      {/* Salary → debts → invest cadence */}
      <div className="border-t border-[color:var(--glass-border)] pt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          Aylıq ritm
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5 rounded-xl border border-[color:var(--glass-border)] p-3 text-center">
            <div className="text-xs font-semibold text-black/85 dark:text-white/90">
              Ay sonu
            </div>
            <div className="text-[11px] leading-snug text-black/45 dark:text-white/50">
              Maaş daxil olur
            </div>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl border border-[color:var(--glass-border)] p-3 text-center">
            <div className="text-xs font-semibold text-black/85 dark:text-white/90">
              1–10
            </div>
            <div className="text-[11px] leading-snug text-black/45 dark:text-white/50">
              Borclar və öhdəliklər
            </div>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl border border-brand-green/40 bg-brand-green/5 p-3 text-center">
            <div className="text-xs font-semibold text-brand-green dark:text-emerald-400">
              15-i
            </div>
            <div className="text-[11px] leading-snug text-black/45 dark:text-white/50">
              İnvestisiya günü
            </div>
            <div className="num text-[11px] font-medium text-brand-green dark:text-emerald-400">
              {formatPolicyDate(report.nextContribution, "short")}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--glass-border)] pt-3 text-[11px] leading-snug text-black/45 dark:text-white/50">
        Rebalans axını birtərəflidir: satış gəlirləri indeksə gedir, ETF payı
        digər səbətləri doldurmaq üçün heç vaxt satılmır. Qaydalara istənilən
        dəyişiklik {POLICY.coolingOffDays} günlük düşünmə müddəti tələb edir —
        qərar yazılı və tarixli olmalıdır.
      </div>
    </div>
  );
}
