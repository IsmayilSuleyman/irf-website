"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BankProductTerms, ProductTerm } from "@/lib/bankTerms";

// Owner-only panel: edit the advertised deposit/credit rate tiers that feed
// the public calculators. Per-account terms still come from the Sheet.

type RowDraft = { termMonths: string; annualRatePct: string };

function toDrafts(terms: ProductTerm[]): RowDraft[] {
  return terms.map((t) => ({
    termMonths: String(t.termMonths),
    annualRatePct: String(t.annualRatePct),
  }));
}

// Validate drafts; returns parsed rows sorted by months, or an Azerbaijani
// error message.
function parseRows(rows: RowDraft[]): { terms: ProductTerm[] } | { error: string } {
  if (rows.length === 0) {
    return { error: "Ən azı bir sətir olmalıdır." };
  }
  const terms: ProductTerm[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.termMonths.trim() === "" || row.annualRatePct.trim() === "") {
      return { error: `Sətir ${i + 1}: boş xana var — müddət və faiz doldurulmalıdır.` };
    }
    const months = Number(row.termMonths);
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      return { error: `Sətir ${i + 1}: müddət 1–120 ay aralığında tam ədəd olmalıdır.` };
    }
    const rate = Number(row.annualRatePct);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return { error: `Sətir ${i + 1}: illik faiz 0–100 aralığında olmalıdır.` };
    }
    if (seen.has(months)) {
      return { error: `Eyni müddət (${months} ay) iki dəfə daxil edilib.` };
    }
    seen.add(months);
    terms.push({ termMonths: months, annualRatePct: rate });
  }
  terms.sort((a, b) => a.termMonths - b.termMonths);
  return { terms };
}

const inputClass =
  "num w-20 rounded-lg border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/10 px-2 py-1.5 text-sm text-ink dark:text-white/90 outline-none focus:border-bank-blue";

function TermsBlock({
  title,
  product,
  initial,
}: {
  title: string;
  product: "deposit" | "credit";
  initial: ProductTerm[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<RowDraft[]>(() => toDrafts(initial));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (idx: number, field: keyof RowDraft, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { termMonths: "", annualRatePct: "" }]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setMsg(null);
    setError(null);
    const parsed = parseRows(rows);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/bank-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, terms: parsed.terms }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Yadda saxlanılmadı.");
        return;
      }
      setRows(toDrafts(parsed.terms));
      setMsg("Yadda saxlanıldı — kalkulyator yeniləndi.");
      router.refresh();
    } catch {
      setError("Yadda saxlanılmadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-[12px] font-semibold text-ink dark:text-white/90">{title}</p>

      <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-black/45 dark:text-white/50">
        <span className="w-20">Müddət (ay)</span>
        <span className="w-20">İllik faiz %</span>
      </div>

      <div className="mt-1 space-y-1.5">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              step={1}
              value={row.termMonths}
              onChange={(e) => update(idx, "termMonths", e.target.value)}
              className={inputClass}
              aria-label="Müddət (ay)"
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={row.annualRatePct}
              onChange={(e) => update(idx, "annualRatePct", e.target.value)}
              className={inputClass}
              aria-label="İllik faiz %"
            />
            <button
              type="button"
              onClick={() => removeRow(idx)}
              aria-label="Sətri sil"
              className="rounded-lg px-2 py-1 text-sm text-black/45 transition hover:text-brand-red dark:text-white/50 dark:hover:text-red-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-2 text-[12px] font-semibold text-bank-blue transition hover:underline dark:text-blue-400"
      >
        + Sətir əlavə et
      </button>

      {msg && <div className="mt-2 text-xs text-brand-green-deep dark:text-emerald-400">{msg}</div>}
      {error && <div className="mt-2 text-xs text-status-late dark:text-rose-400">{error}</div>}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-3 rounded-full bg-bank-blue px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-bank-blue-deep disabled:opacity-50"
      >
        {busy ? "Saxlanılır..." : "Yadda saxla"}
      </button>
    </div>
  );
}

export function BankTermsPanel({ initial }: { initial: BankProductTerms }) {
  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
        İdarəetmə · Faiz dərəcələri
      </p>
      <p className="mt-1 text-[12px] text-black/45 dark:text-white/50">
        Buradakı dərəcələr kalkulyatorda göstərilən təklif şərtləridir — mövcud hesablara toxunmur.
      </p>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <TermsBlock title="Depozit faizləri" product="deposit" initial={initial.deposit} />
        <TermsBlock title="Kredit faizləri" product="credit" initial={initial.credit} />
      </div>
    </section>
  );
}
