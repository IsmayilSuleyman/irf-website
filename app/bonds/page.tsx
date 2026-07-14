import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { getBondMarketData, type BondPaymentRow, type BondSeries } from "@/lib/bonds";
import { formatBakuDate } from "@/lib/user";
import { formatGrouped, formatGroupedTrim, formatUnits } from "@/lib/portfolio";
import { BankHeader } from "@/components/BankHeader";
import { MotionSection } from "@/components/MotionSection";
import { BondTicket } from "@/components/bonds/BondTicket";
import { BondBook } from "@/components/bonds/BondBook";
import { MyBondOrders } from "@/components/bonds/MyBondOrders";
import { MyBondMatches } from "@/components/bonds/MyBondMatches";
import { BondAdminPanel } from "@/components/bonds/BondAdminPanel";

export const dynamic = "force-dynamic";

const norm = (s: string) =>
  s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");

function formatDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : formatBakuDate(parsed);
}

const STATUS_META: Record<BondSeries["status"], { label: string; cls: string }> = {
  active: {
    label: "Aktiv",
    cls: "bg-brand-green-mist dark:bg-brand-green/15 text-status-paid dark:text-emerald-400",
  },
  matured: {
    label: "Ödənilib",
    cls: "bg-bank-blue-soft dark:bg-bank-blue/20 text-bank-blue dark:text-blue-400",
  },
  cancelled: {
    label: "Ləğv edilib",
    cls: "bg-black/5 dark:bg-white/10 text-black/45 dark:text-white/50",
  },
};

function SeriesCard({ series, selected }: { series: BondSeries; selected: boolean }) {
  const soldPct =
    series.total_units > 0 ? (series.primary_sold / series.total_units) * 100 : 0;
  const status = STATUS_META[series.status];

  return (
    <Link
      href={`/bonds?s=${series.id}`}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={`flex flex-col gap-3 rounded-2xl border bg-white/90 px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-sm dark:bg-white/10 ${
        selected
          ? "border-bank-blue dark:border-blue-400/60 shadow-sm"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
          {series.name}
        </span>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.cls}`}>
          {status.label}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-black/45 dark:text-white/50">
        <span>
          Kupon{" "}
          <span className="num font-semibold text-ink dark:text-white/90">
            {formatGroupedTrim(series.coupon_rate_pct, 2)}%
          </span>{" "}
          illik · hər {series.coupon_period_months} ay
        </span>
        <span>
          Nominal{" "}
          <span className="num font-semibold text-ink dark:text-white/90">
            {formatGrouped(series.face_value_azn, 2)} ₼
          </span>
        </span>
        <span>
          Ödəmə{" "}
          <span className="font-semibold text-ink dark:text-white/90">
            {formatDisplayDate(series.maturity_date)}
          </span>
        </span>
      </div>

      <div className="space-y-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-bank-blue/70"
            style={{ width: `${Math.min(soldPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-black/45 dark:text-white/50">
          <span>
            Buraxılış: <span className="num">{formatUnits(series.primary_sold)}</span> /{" "}
            <span className="num">{formatUnits(series.total_units)}</span>
          </span>
          {series.my_units > 0 ? (
            <span className="font-semibold text-bank-blue dark:text-blue-400">
              Mənim: <span className="num">{formatUnits(series.my_units)}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function MyPayments({ payments }: { payments: BondPaymentRow[] }) {
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bank-blue dark:text-blue-400">
        İstiqraz ödənişlərim
      </div>
      {payments.length === 0 ? (
        <div className="py-4 text-center text-xs text-black/45 dark:text-white/50">
          Hələ kupon və ya nominal ödənişi yoxdur.
        </div>
      ) : (
        <div className="mt-2 flex flex-col divide-y divide-black/5 dark:divide-white/10">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-ink dark:text-white/90">
                  {p.payment_kind === "principal" ? "Nominal dəyər" : "Kupon"} ·{" "}
                  {formatDisplayDate(p.due_date)}
                </span>
                <span className="text-[11px] text-black/45 dark:text-white/50">
                  <span className="num">{formatUnits(p.units)}</span> istiqraz üzrə
                </span>
              </div>
              <span className="num text-sm font-semibold text-status-paid dark:text-emerald-400">
                +{formatGrouped(p.amount_azn, 2)} ₼
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function BondsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireUser("/bonds");
  const sp = await searchParams;
  const data = await getBondMarketData();
  const dateLabel = formatBakuDate(new Date());

  if (!data) {
    return (
      <main className="min-h-screen bg-bank-section">
        <BankHeader dateLabel={dateLabel} />
        <div className="mx-auto max-w-5xl px-6 py-16 text-center text-sm text-black/55 dark:text-white/60">
          İstiqraz məlumatları yüklənmədi.
        </div>
      </main>
    );
  }

  const seriesNames = Object.fromEntries(data.series.map((s) => [s.id, s.name]));
  const requested = typeof sp?.s === "string" ? sp.s : null;
  const selected =
    data.series.find((s) => s.id === requested) ??
    data.series.find((s) => s.status === "active") ??
    data.series[0] ??
    null;

  // For İsmayıl `payments` holds every holder's rows; his personal card
  // should only show his own.
  const myPayments = data.isAdmin
    ? data.payments.filter(
        (p) => !!data.holderName && norm(p.holder_name) === norm(data.holderName),
      )
    : data.payments;

  return (
    <main className="min-h-screen bg-bank-section">
      <BankHeader dateLabel={dateLabel} />

      <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <MotionSection>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
                İsmayılBank · İstiqrazlar
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-ink dark:text-white/90">
                İstiqraz bazarı
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-black/55 dark:text-white/60">
                Bank kupon istiqrazları buraxır: nominal dəyər üzərindən illik faiz
                müəyyən dövrlərlə ödənilir, müddətin sonunda isə nominal geri qaytarılır.
                İstiqrazları ilkin buraxılışdan alıb digər iştirakçılarla alqı-satqı edə
                bilərsiniz. Uyğunlaşmalar İsmayıl təsdiqləyənə qədər gözləmədə qalır.
              </p>
            </div>
            <Link
              href="/bank"
              className="inline-flex items-center justify-center rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-white/10 px-4 py-2.5 text-sm font-medium text-black/70 dark:text-white/75 transition hover:border-bank-blue/30 hover:text-bank-blue dark:hover:text-blue-400"
            >
              ← Bank hesabım
            </Link>
          </div>
        </MotionSection>

        {data.isAdmin ? (
          <MotionSection delay={0.05}>
            <div className="mt-8">
              <BondAdminPanel
                series={data.series}
                pending={data.adminPending}
                payments={data.payments}
              />
            </div>
          </MotionSection>
        ) : null}

        {data.series.length === 0 ? (
          <MotionSection delay={0.08}>
            <div className="mt-12 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-10 text-center text-sm text-black/55 dark:text-white/60">
              Hələ istiqraz buraxılışı yoxdur.
              {data.isAdmin
                ? " Yuxarıdakı formada ilk seriyanı buraxın."
                : " Yeni buraxılış elan olunanda bildiriş alacaqsınız."}
            </div>
          </MotionSection>
        ) : (
          <>
            <MotionSection delay={0.08}>
              <h2 className="mt-10 text-[15px] font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
                Buraxılışlar
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.series.map((s) => (
                  <SeriesCard key={s.id} series={s} selected={selected?.id === s.id} />
                ))}
              </div>
            </MotionSection>

            {selected ? (
              <MotionSection delay={0.12}>
                <div className="mt-10 flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
                    {selected.name} — ticarət
                  </h2>
                  {selected.next_coupon_date ? (
                    <span className="text-[11px] text-black/45 dark:text-white/50">
                      Növbəti kupon: {formatDisplayDate(selected.next_coupon_date)}
                    </span>
                  ) : null}
                </div>
                {selected.status === "active" ? (
                  <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <BondTicket series={selected} isPrincipal={data.isAdmin} />
                    <BondBook series={selected} book={data.books[selected.id] ?? []} />
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-8 text-center text-sm text-black/55 dark:text-white/60">
                    Bu seriya üzrə ticarət bağlıdır (
                    {STATUS_META[selected.status].label.toLocaleLowerCase("az-AZ")}).
                  </div>
                )}
              </MotionSection>
            ) : null}

            <MotionSection delay={0.16}>
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <MyBondOrders orders={data.myOrders} seriesNames={seriesNames} />
                <MyBondMatches
                  trades={data.myTrades}
                  userId={data.user.id}
                  holderName={data.holderName}
                  seriesNames={seriesNames}
                />
              </div>
            </MotionSection>

            <MotionSection delay={0.2}>
              <div className="mt-6">
                <MyPayments payments={myPayments} />
              </div>
            </MotionSection>
          </>
        )}
      </section>
    </main>
  );
}
