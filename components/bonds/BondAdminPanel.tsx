"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatGrouped, formatUnits } from "@/lib/portfolio";
import type { BondPaymentRow, BondSeries, BondTradeRow } from "@/lib/bonds";

const price2 = (n: number) => `${formatGrouped(n, 2)} ₼`;

const KIND_LABEL: Record<BondTradeRow["counterparty_kind"], string> = {
  p2p: "İştirakçılar arası",
  primary: "İlkin buraxılış",
};

const card =
  "rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6";
const eyebrow =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50";
const inputCls =
  "num rounded-lg border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/10 px-2.5 py-1.5 text-sm text-ink dark:text-white/90 outline-none focus:border-bank-blue";
const primaryBtn =
  "rounded-full bg-bank-blue px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0";
const ghostBtn =
  "rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-[11px] font-medium text-black/55 dark:text-white/60 transition hover:border-brand-red hover:text-brand-red dark:hover:text-red-400 disabled:opacity-50";

// Postgres `date + make_interval(months => n)` clamps to the target month's
// end (Jan 31 + 1 month = Feb 28) — mirror that exactly so the client-side
// schedule always matches the dates record_bond_payment will accept.
function addMonthsIso(iso: string, months: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const target = new Date(Date.UTC(y, mo + months, 1));
  const daysInMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, daysInMonth)),
  )
    .toISOString()
    .slice(0, 10);
}

function couponSchedule(s: BondSeries): string[] {
  const dates: string[] = [];
  for (let n = 1; n <= 240; n += 1) {
    const d = addMonthsIso(s.issue_date, n * s.coupon_period_months);
    if (!d || d > s.maturity_date) break;
    dates.push(d);
  }
  return dates;
}

/** İsmayıl's bond administration: settle trades, issue series, record payments. */
export function BondAdminPanel({
  series,
  pending,
  payments,
}: {
  series: BondSeries[];
  pending: BondTradeRow[];
  payments: BondPaymentRow[];
}) {
  const seriesNames = useMemo(
    () => Object.fromEntries(series.map((s) => [s.id, s.name])),
    [series],
  );

  return (
    <div className="flex flex-col gap-4">
      <Settlements pending={pending} seriesNames={seriesNames} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IssueForm series={series} />
        <PaymentsRecorder series={series} payments={payments} />
      </div>
    </div>
  );
}

function Settlements({
  pending,
  seriesNames,
}: {
  pending: BondTradeRow[];
  seriesNames: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (tradeId: string, action: "confirm" | "reject") => {
    setBusy(tradeId + action);
    setError(null);
    const res = await fetch("/api/admin/bonds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, tradeId }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Əməliyyat alınmadı.");
      return;
    }
    router.refresh();
  };

  return (
    <div className={card}>
      <div className={eyebrow}>İdarəetmə · İstiqraz hesablaşmaları</div>
      {error && <div className="mt-2 text-xs text-brand-red dark:text-red-400">{error}</div>}
      {pending.length === 0 ? (
        <div className="py-3 text-center text-xs text-black/45 dark:text-white/50">
          Təsdiq gözləyən uyğunlaşma yoxdur.
        </div>
      ) : (
        <div className="mt-2 flex flex-col divide-y divide-black/5 dark:divide-white/10">
          {pending.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-ink dark:text-white/90">
                  <span className="font-medium">{t.seller_name}</span>
                  {" → "}
                  <span className="font-medium">{t.buyer_name}</span>
                </span>
                <span className="text-[11px] text-black/45 dark:text-white/50">
                  {seriesNames[t.series_id] ?? "—"} ·{" "}
                  <span className="num">{formatUnits(t.units)}</span> istiqraz ·{" "}
                  <span className="num">{price2(t.price)}</span> · {KIND_LABEL[t.counterparty_kind]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => act(t.id, "confirm")}
                  disabled={busy === t.id + "confirm"}
                  className={primaryBtn}
                >
                  {busy === t.id + "confirm" ? "..." : "Təsdiqlə"}
                </button>
                <button
                  onClick={() => act(t.id, "reject")}
                  disabled={busy === t.id + "reject"}
                  className={ghostBtn}
                >
                  {busy === t.id + "reject" ? "..." : "Rədd et"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueForm({ series }: { series: BondSeries[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [faceValue, setFaceValue] = useState("100");
  const [couponRate, setCouponRate] = useState("12");
  const [couponPeriod, setCouponPeriod] = useState("3");
  const [termMonths, setTermMonths] = useState("12");
  const [issuePrice, setIssuePrice] = useState("100");
  const [totalUnits, setTotalUnits] = useState("50");
  const [announce, setAnnounce] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const activeSeries = series.filter((s) => s.status === "active");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);

    const term = Number(termMonths);
    const period = Number(couponPeriod);
    if (!name.trim()) {
      setError("Seriya adı tələb olunur.");
      return;
    }
    if (!Number.isInteger(term) || term <= 0 || !Number.isInteger(period) || period <= 0 || term % period !== 0) {
      setError("Müddət kupon dövrünə tam bölünməlidir (məs. 12 ay / 3 ay).");
      return;
    }

    setBusy("issue");
    const res = await fetch("/api/admin/bonds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "issue",
        name: name.trim(),
        faceValue: Number(faceValue),
        couponRatePct: Number(couponRate),
        couponPeriodMonths: period,
        termMonths: term,
        issuePrice: Number(issuePrice),
        totalUnits: Number(totalUnits),
        announce,
      }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Buraxılış alınmadı.");
      return;
    }
    setMsg(
      announce
        ? `Seriya buraxıldı və ${json.announced ?? 0} istifadəçiyə elan göndərildi.`
        : "Seriya buraxıldı.",
    );
    setName("");
    router.refresh();
  };

  const cancelSeries = async (s: BondSeries) => {
    if (!window.confirm(`${s.name} seriyasını ləğv etmək istədiyinizə əminsiniz? Açıq sifarişlər də ləğv olunacaq.`)) {
      return;
    }
    setBusy("cancel" + s.id);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/admin/bonds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_series", seriesId: s.id }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Ləğv alınmadı.");
      return;
    }
    setMsg(`${s.name} ləğv edildi.`);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className={card}>
      <div className={eyebrow}>İdarəetmə · Yeni istiqraz buraxılışı</div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Seriya adı" full>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="İB-2027A"
            className={`${inputCls} w-full`}
          />
        </Field>
        <Field label="Nominal dəyər (₼)">
          <input type="number" min="1" step="0.01" value={faceValue} onChange={(e) => setFaceValue(e.target.value)} className={`${inputCls} w-full`} />
        </Field>
        <Field label="Buraxılış qiyməti (₼)">
          <input type="number" min="1" step="0.01" value={issuePrice} onChange={(e) => setIssuePrice(e.target.value)} className={`${inputCls} w-full`} />
        </Field>
        <Field label="Kupon (illik %)">
          <input type="number" min="0" max="100" step="0.01" value={couponRate} onChange={(e) => setCouponRate(e.target.value)} className={`${inputCls} w-full`} />
        </Field>
        <Field label="Kupon dövrü (ay)">
          <select value={couponPeriod} onChange={(e) => setCouponPeriod(e.target.value)} className={`${inputCls} w-full`}>
            {[1, 2, 3, 4, 6, 12].map((m) => (
              <option key={m} value={m}>{m} ay</option>
            ))}
          </select>
        </Field>
        <Field label="Müddət (ay)">
          <input type="number" min="1" max="240" step="1" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} className={`${inputCls} w-full`} />
        </Field>
        <Field label="İstiqraz sayı">
          <input type="number" min="1" step="1" value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} className={`${inputCls} w-full`} />
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-black/55 dark:text-white/60">
        <input
          type="checkbox"
          checked={announce}
          onChange={(e) => setAnnounce(e.target.checked)}
          className="h-3.5 w-3.5 accent-bank-blue"
        />
        Bütün istifadəçilərə elan göndər
      </label>

      {error && <div className="mt-2 text-xs text-brand-red dark:text-red-400">{error}</div>}
      {msg && <div className="mt-2 text-xs text-brand-green dark:text-emerald-400">{msg}</div>}

      <button type="submit" disabled={busy === "issue"} className={`${primaryBtn} mt-4`}>
        {busy === "issue" ? "Buraxılır..." : "Seriyanı burax"}
      </button>

      {activeSeries.length > 0 && (
        <div className="mt-4 border-t border-black/5 dark:border-white/10 pt-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            Aktiv seriyalar
          </div>
          <div className="mt-1 flex flex-col divide-y divide-black/5 dark:divide-white/10">
            {activeSeries.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                <span className="text-black/70 dark:text-white/75">
                  {s.name} · satılıb <span className="num">{formatUnits(s.primary_sold)}</span> /{" "}
                  <span className="num">{formatUnits(s.total_units)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => cancelSeries(s)}
                  disabled={busy === "cancel" + s.id}
                  className={ghostBtn}
                >
                  {busy === "cancel" + s.id ? "..." : "Ləğv et"}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-black/45 dark:text-white/50">
            Yalnız heç bir əqdi olmayan seriya ləğv edilə bilər.
          </p>
        </div>
      )}
    </form>
  );
}

function PaymentsRecorder({
  series,
  payments,
}: {
  series: BondSeries[];
  payments: BondPaymentRow[];
}) {
  const router = useRouter();
  const recordable = series.filter((s) => s.status !== "cancelled");
  const [seriesId, setSeriesId] = useState(recordable[0]?.id ?? "");
  const [kind, setKind] = useState<"coupon" | "principal">("coupon");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // router.refresh() keeps client state, so a series issued after mount would
  // leave seriesId empty — fall back to the first recordable series.
  const effectiveSeriesId = recordable.some((s) => s.id === seriesId)
    ? seriesId
    : recordable[0]?.id ?? "";
  const selected = recordable.find((s) => s.id === effectiveSeriesId);

  // The DB only accepts dates that sit exactly on the coupon schedule, so the
  // date is a pick-list, not free text; already-recorded dates are marked.
  const schedule = selected ? couponSchedule(selected) : [];
  const recordedCoupons = new Set(
    payments
      .filter((p) => p.series_id === selected?.id && p.payment_kind === "coupon")
      .map((p) => p.due_date),
  );
  const defaultCouponDate =
    schedule.find((d) => !recordedCoupons.has(d)) ?? schedule[schedule.length - 1] ?? "";
  const effectiveDueDate =
    kind === "principal"
      ? selected?.maturity_date ?? ""
      : schedule.includes(dueDate)
        ? dueDate
        : defaultCouponDate;

  const record = async () => {
    if (!effectiveSeriesId || !effectiveDueDate) {
      setError("Seriya və tarix seçilməlidir.");
      return;
    }
    const label = kind === "principal" ? "nominal dəyər ödənişini" : "kupon ödənişini";
    if (!window.confirm(`${selected?.name ?? "Seriya"} üzrə ${effectiveDueDate} tarixli ${label} qeyd etmək istədiyinizə əminsiniz?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/admin/bonds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_payment",
        seriesId: effectiveSeriesId,
        kind,
        dueDate: effectiveDueDate,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Qeyd alınmadı.");
      return;
    }
    const r = json.result ?? {};
    setMsg(
      Number(r.count) > 0
        ? `Qeyd edildi: ${r.count} sahib, cəmi ${formatGrouped(Number(r.total_azn ?? 0), 2)} ₼.`
        : "Yeni qeyd yoxdur (artıq qeyd edilib və ya sahib yoxdur).",
    );
    router.refresh();
  };

  // Recent recorded payments, newest first, grouped per (series, kind, date).
  const recent = useMemo(() => {
    const groups = new Map<string, { name: string; kind: string; date: string; total: number; holders: number }>();
    for (const p of payments) {
      const key = `${p.series_id}|${p.payment_kind}|${p.due_date}`;
      const g = groups.get(key) ?? {
        name: series.find((s) => s.id === p.series_id)?.name ?? "—",
        kind: p.payment_kind,
        date: p.due_date,
        total: 0,
        holders: 0,
      };
      g.total += p.amount_azn;
      g.holders += 1;
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  }, [payments, series]);

  return (
    <div className={card}>
      <div className={eyebrow}>İdarəetmə · Kupon və nominal ödənişləri</div>
      <p className="mt-2 text-xs leading-5 text-black/45 dark:text-white/50">
        Ödənişi bankdan kənarda etdikdən sonra burada qeyd edin — sahiblərə bildiriş
        gedir və ödəniş tarixçəyə düşür. Nominal qeyd edildikdə seriya bağlanır.
      </p>

      {recordable.length === 0 ? (
        <div className="py-3 text-center text-xs text-black/45 dark:text-white/50">
          Hələ seriya yoxdur.
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Seriya" full>
              <select value={effectiveSeriesId} onChange={(e) => setSeriesId(e.target.value)} className={`${inputCls} w-full`}>
                {recordable.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Növ">
              <select value={kind} onChange={(e) => setKind(e.target.value as "coupon" | "principal")} className={`${inputCls} w-full`}>
                <option value="coupon">Kupon</option>
                <option value="principal">Nominal (ödəmə)</option>
              </select>
            </Field>
            <Field label="Tarix">
              {kind === "principal" ? (
                <span className={`${inputCls} num flex w-full items-center bg-black/[0.02] dark:bg-white/5`}>
                  {selected?.maturity_date ?? "—"}
                </span>
              ) : (
                <select
                  value={effectiveDueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`${inputCls} w-full`}
                >
                  {schedule.map((d) => (
                    <option key={d} value={d}>
                      {d}
                      {recordedCoupons.has(d) ? " — qeyd edilib" : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          {error && <div className="mt-2 text-xs text-brand-red dark:text-red-400">{error}</div>}
          {msg && <div className="mt-2 text-xs text-brand-green dark:text-emerald-400">{msg}</div>}

          <button type="button" onClick={record} disabled={busy} className={`${primaryBtn} mt-4`}>
            {busy ? "Qeyd edilir..." : "Ödənişi qeyd et"}
          </button>
        </>
      )}

      {recent.length > 0 && (
        <div className="mt-4 border-t border-black/5 dark:border-white/10 pt-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            Son qeydlər
          </div>
          <div className="mt-1 flex flex-col divide-y divide-black/5 dark:divide-white/10">
            {recent.map((g, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2 text-xs">
                <span className="text-black/70 dark:text-white/75">
                  {g.name} · {g.kind === "principal" ? "Nominal" : "Kupon"} · {g.date}
                </span>
                <span className="num shrink-0 text-black/55 dark:text-white/60">
                  {g.holders} sahib · {formatGrouped(g.total, 2)} ₼
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "col-span-2" : ""}`}>
      <span className="text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}
