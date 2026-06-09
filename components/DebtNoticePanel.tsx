"use client";

import { useState } from "react";
import { formatAzn } from "@/lib/portfolio";

type Debtor = { name: string; amount: number };

export function DebtNoticePanel({ debtors }: { debtors: Debtor[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (
    payload: { holderName?: string; all?: boolean },
    key: string,
  ) => {
    setBusy(key);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/debt-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Göndərilmədi.");
        return;
      }
      const extra = json.skipped
        ? `, ${json.skipped} ötürüldü (tətbiq hesabı yoxdur)`
        : "";
      setMsg(`${json.sent} bildiriş göndərildi${extra}.`);
    } catch {
      setError("Göndərilmədi.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10">
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bank-blue dark:text-blue-400">
            İdarəetmə · Borc xatırlatması
          </p>
          <p className="mt-1 text-[12px] text-black/45 dark:text-white/50">
            Borclulara &quot;borcunuzu ödəyin&quot; bildirişi göndər.
          </p>
        </div>
        {debtors.length > 0 && (
          <button
            onClick={() => send({ all: true }, "all")}
            disabled={busy !== null}
            className="shrink-0 rounded-full bg-bank-blue px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-bank-blue-deep disabled:opacity-50"
          >
            {busy === "all" ? "Göndərilir..." : "Hamısına göndər"}
          </button>
        )}
      </header>

      {msg && <div className="px-5 pb-2 text-xs text-brand-green-deep dark:text-emerald-400">{msg}</div>}
      {error && <div className="px-5 pb-2 text-xs text-status-late dark:text-rose-400">{error}</div>}

      {debtors.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-black/45 dark:text-white/50">
          Borclu yoxdur.
        </div>
      ) : (
        <div className="divide-y divide-black/5 border-t border-black/10 dark:border-white/10">
          {debtors.map((d) => (
            <div
              key={d.name}
              className="flex items-center justify-between gap-4 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink dark:text-white/90">{d.name}</p>
                <p className="mt-0.5 text-xs text-black/45 dark:text-white/50">
                  Qalıq borc: {formatAzn(d.amount)}
                </p>
              </div>
              <button
                onClick={() => send({ holderName: d.name }, d.name)}
                disabled={busy !== null}
                className="shrink-0 rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-[11px] font-medium text-black/70 dark:text-white/75 transition hover:border-bank-blue hover:text-bank-blue dark:hover:text-blue-400 disabled:opacity-50"
              >
                {busy === d.name ? "..." : "Göndər"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
