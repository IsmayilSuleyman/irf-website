import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import type { DepositCoverage } from "@/lib/bankHealth";

// The İsmayıl guarantee, in the /bonds certificate language (banknote
// proportions, guilloche engraving, watermark ₼, inner frame) on a NEW
// emerald/gold face — green is the deposit identity, gold is the seal.
// The certificate carries the promise; the panel beside it carries the
// number that makes the promise real: the coverage ratio.

function coverageTone(ratio: number): string {
  if (ratio >= 1.5) return "text-brand-green-deep dark:text-emerald-400";
  if (ratio >= 1) return "text-status-warn dark:text-amber-400";
  return "text-status-late dark:text-rose-400";
}

function coverageBarTone(ratio: number): string {
  if (ratio >= 1.5) return "bg-brand-green";
  if (ratio >= 1) return "bg-amber-500";
  return "bg-status-late";
}

function Certificate() {
  return (
    <div className="relative aspect-[1.6/1] w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0e7a3c_0%,#0a5d2e_55%,#07451f_100%)] p-5 text-white shadow-[0_24px_50px_-20px_rgba(7,69,31,0.55)] sm:p-6">
      {/* The four certificate art layers, straight from the bond cards. */}
      <div aria-hidden className="absolute -right-14 -top-16 h-48 w-48 rounded-full bg-amber-300/25 blur-2xl" />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 7px)",
        }}
      />
      <div
        aria-hidden
        className="num pointer-events-none absolute -bottom-10 -right-2 select-none text-[10rem] font-black leading-none text-white/[0.06]"
      >
        ₼
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-2 rounded-xl border border-white/15" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-amber-200/85">
            İsmayılBank · Zəmanət sertifikatı
          </p>
          <p className="num shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/55">
            № ZMN-0001
          </p>
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] sm:text-xl">
          İsmayıl zəmanəti
        </h3>
        <p className="mt-1.5 max-w-[36ch] text-[11px] leading-[1.55] text-white/85 sm:text-[12px]">
          Bu bankdakı hər bir depozit — əsas məbləğ və hesablanmış faiz daxil
          olmaqla — İsmayıl Süleyman tərəfindən şəxsən və tam həcmdə
          zəmanətlənir.
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold italic tracking-[-0.01em]">
              İsmayıl Süleyman
            </p>
            <p className="mt-0.5 border-t border-white/25 pt-1 text-[8.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Təsisçi və zamin
            </p>
          </div>
          <span
            aria-hidden
            className="-rotate-6 select-none rounded-lg border-2 border-amber-200/50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.26em] text-amber-100/80"
          >
            Zəmanətlidir
          </span>
        </div>
      </div>
    </div>
  );
}

export function BankGuaranteeCard({ coverage }: { coverage: DepositCoverage | null }) {
  const ratio = coverage?.ratio ?? null;
  const floor = coverage?.minOnly ?? false;
  // The meter runs 0…2×, with the 1× ("fully covered") line at its middle.
  const fillPct = ratio == null ? 0 : Math.max(0, Math.min(ratio / 2, 1)) * 100;

  return (
    <section id="zemanet" className="scroll-mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center">
      <Certificate />

      <div className="rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6 sm:p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
          Təminat əmsalı
        </p>
        {ratio == null ? (
          <p className="mt-2 text-sm text-black/45 dark:text-white/50">
            Hazırda depozit öhdəliyi yoxdur — zəmanət ilk depozitlə birlikdə
            işə düşür.
          </p>
        ) : (
          <>
            <p className={`num mt-1.5 text-[2.2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums ${coverageTone(ratio)}`}>
              {floor ? <span className="mr-1 text-[1rem] font-medium">ən azı</span> : null}
              {formatGroupedTrim(ratio, 2)}×
            </p>
            <p className="mt-1.5 text-xs text-black/45 dark:text-white/50">
              hər 1 ₼ depozitə {formatGroupedTrim(ratio, 2)} ₼ təminat
              {floor ? " — fondun payı bu renderdə hesablanmadı, real əmsal daha yüksəkdir" : ""}
            </p>

            <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10" aria-hidden>
              <div
                className={`h-full rounded-full ${coverageBarTone(ratio)} transition-all`}
                style={{ width: `${fillPct}%` }}
              />
              <span className="absolute inset-y-0 left-1/2 w-px bg-black/30 dark:bg-white/40" />
            </div>
            <p className="mt-1.5 text-[10px] font-medium text-black/40 dark:text-white/45">
              orta xətt 1× — depozitlərin tam örtülmə həddi
            </p>

            <div className="mt-5 space-y-2 border-t border-black/10 dark:border-white/10 pt-4 text-[13px]">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-black/55 dark:text-white/60">Bankın sərbəst likvidliyi</span>
                <span className="num font-semibold tabular-nums text-ink dark:text-white/90">
                  {formatAzn(coverage!.netLiquidityAzn)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-black/55 dark:text-white/60">İsmayılın fond payı (canlı)</span>
                <span className="num font-semibold tabular-nums text-ink dark:text-white/90">
                  {floor ? "—" : formatAzn(coverage!.principalStakeAzn)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-black/5 dark:border-white/5 pt-2">
                <span className="font-medium text-ink dark:text-white/90">Cəmi təminat</span>
                <span className="num font-semibold tabular-nums text-brand-green-deep dark:text-emerald-400">
                  {formatAzn(coverage!.backingAzn)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-ink dark:text-white/90">Depozit öhdəlikləri</span>
                <span className="num font-semibold tabular-nums text-ink dark:text-white/90">
                  {formatAzn(coverage!.depositObligationsAzn)}
                </span>
              </div>
            </div>
          </>
        )}

        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-black/40 dark:text-white/45 transition hover:text-bank-blue dark:hover:text-blue-400 [&::-webkit-details-marker]:hidden">
            Qeyd{" "}
            <span aria-hidden className="inline-block transition group-open:rotate-90">
              ▸
            </span>
          </summary>
          <p className="mt-2 text-[11px] leading-[1.5] text-black/45 dark:text-white/50">
            Təminat sırası: bankın sərbəst vəsaiti → kredit qaytarımları →
            İsmayılın fond payı → şəxsi zəmanət. Zəmanət depozitin əsas
            məbləğini və hesablanmış faizini əhatə edir; öhdəliklərə
            hesablaşılmamış günlük faiz və mükafatlar da daxildir.
          </p>
        </details>
      </div>
    </section>
  );
}
