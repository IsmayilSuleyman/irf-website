"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatGrouped, formatGroupedTrim } from "@/lib/portfolio";
import { CreditOfferBanner } from "@/components/CreditOfferBanner";
import type { CreditOffer, CreditOfferMode } from "@/lib/creditOffers";

// İsmayıl's cabinet, as a TABLE: one row per account (sheet accounts plus
// any offer rows for names outside the sheet — bond-only holders), with the
// rule edited inline. "Bu gün" live-previews what the draft resolves to as
// he types; "Bax" renders the exact banner that holder would see.

const AZN_CAP = 1_000_000;

/** AZ-style amount parsing: "1.000" is one thousand, "10,5" is ten and a
 *  half, "1.000,50" both — a bare Number() would read "1.000" as 1 ₼. */
function parseAmount(raw: string): number | null {
  let t = raw.trim().replace(/\s/g, "");
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type RowDraft = { mode: CreditOfferMode; value: string };

export function CreditOfferPanel({
  accountNames,
  loanHolders,
  offers,
  netLiquidityAzn,
  minRatePct,
}: {
  accountNames: string[];
  /** Accounts with an active loan — their offer exists but stays hidden. */
  loanHolders: string[];
  offers: CreditOffer[];
  netLiquidityAzn: number;
  /** Lowest live credit rate — for the banner preview's teaser line. */
  minRatePct: number | null;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const offerByName = useMemo(
    () => new Map(offers.map((o) => [o.holderName, o])),
    [offers],
  );
  // Sheet accounts first, then offer rows for names the sheet doesn't know
  // (bond-only holders), then names added by hand this session.
  const rows = useMemo(() => {
    const seen = new Set(accountNames);
    const extras = [
      ...offers.map((o) => o.holderName).filter((n) => !seen.has(n)),
      ...extraNames.filter((n) => !seen.has(n)),
    ];
    return [...accountNames, ...[...new Set(extras)]];
  }, [accountNames, offers, extraNames]);

  const draftFor = (name: string): RowDraft => {
    const saved = offerByName.get(name);
    return (
      drafts[name] ?? {
        mode: saved?.mode ?? "azn",
        value: saved != null ? formatGroupedTrim(saved.value, 2) : "",
      }
    );
  };
  const setDraft = (name: string, patch: Partial<RowDraft>) => {
    setError(null);
    setDrafts((d) => ({ ...d, [name]: { ...draftFor(name), ...patch } }));
  };

  const resolveAzn = (mode: CreditOfferMode, value: number): number =>
    mode === "azn"
      ? Math.floor(value)
      : Math.max(0, Math.floor((netLiquidityAzn * value) / 100));

  const isDirty = (name: string): boolean => {
    const d = drafts[name];
    if (d == null) return false;
    const saved = offerByName.get(name);
    const parsed = parseAmount(d.value);
    if (saved == null) return parsed != null && parsed > 0;
    return d.mode !== saved.mode || parsed !== saved.value;
  };

  function save(name: string) {
    const d = draftFor(name);
    const value = parseAmount(d.value);
    setError(null);
    if (value == null || value <= 0) return setError("Düzgün məbləğ daxil edin.");
    if (d.mode === "pct" && value > 100)
      return setError("Faiz 100-dən böyük ola bilməz.");
    if (d.mode === "azn" && value > AZN_CAP)
      return setError("Məbləğ 1.000.000 ₼ həddini aşır.");
    startTransition(async () => {
      const res = await fetch("/api/admin/credit-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holderName: name, mode: d.mode, value }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Yadda saxlanılmadı.");
        return;
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      router.refresh();
    });
  }

  function remove(name: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/credit-offers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holderName: name }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Silinmədi.");
        return;
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      if (previewName === name) setPreviewName(null);
      router.refresh();
    });
  }

  const TH =
    "pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40 dark:text-white/45";
  const previewOffer = previewName != null ? offerByName.get(previewName) : null;

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-5">
      <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
        Kredit təklifləri
      </h3>
      <p className="mt-1 text-[11px] leading-4 text-black/45 dark:text-white/50">
        Hesab üzrə təklif: sabit ₼ və ya qalan likvidliyin{" "}
        <span className="num">({formatGrouped(netLiquidityAzn, 0)} ₼)</span>{" "}
        faizi kimi. Aktiv krediti olan hesaba banner göstərilmir.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse">
          <thead>
            <tr>
              <th className={TH}>Hesab</th>
              <th className={TH}>Rejim</th>
              <th className={TH}>Dəyər</th>
              <th className={`${TH} text-right`}>Bu gün</th>
              <th className={TH}>Banner</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {rows.map((name) => {
              const saved = offerByName.get(name);
              const d = draftFor(name);
              const parsed = parseAmount(d.value);
              const hasLoan = loanHolders.includes(name);
              const today =
                parsed != null && parsed > 0 && !(d.mode === "pct" && parsed > 100)
                  ? resolveAzn(d.mode, parsed)
                  : null;
              return (
                <tr
                  key={name}
                  className="border-t border-black/5 dark:border-white/10"
                >
                  <td className="max-w-[11rem] py-2 pr-2 align-middle">
                    <span className="block truncate text-[13px] font-medium text-ink dark:text-white/90">
                      {name}
                    </span>
                  </td>
                  <td className="py-2 pr-2 align-middle">
                    <span className="inline-flex overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
                      {(["azn", "pct"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          disabled={pending}
                          onClick={() => setDraft(name, { mode: m })}
                          className={`px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                            d.mode === m
                              ? "bg-bank-blue/15 text-bank-blue dark:text-blue-400"
                              : "text-black/40 hover:text-black/80 dark:text-white/45 dark:hover:text-white/85"
                          }`}
                        >
                          {m === "azn" ? "₼" : "%"}
                        </button>
                      ))}
                    </span>
                  </td>
                  <td className="py-2 pr-2 align-middle">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={d.value}
                      onChange={(e) => setDraft(name, { value: e.target.value })}
                      placeholder={d.mode === "azn" ? "300" : "10"}
                      disabled={pending}
                      className="num w-20 rounded-lg border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 px-2 py-1.5 text-[13px] text-ink dark:text-white/90 outline-none focus:border-bank-blue/50"
                    />
                  </td>
                  <td className="num py-2 pr-2 text-right align-middle text-[13px] font-semibold text-bank-blue dark:text-blue-400">
                    {today != null ? `${formatGrouped(today, 0)} ₼` : "—"}
                  </td>
                  <td className="py-2 pr-2 align-middle">
                    {saved == null ? (
                      <span className="text-[11px] text-black/35 dark:text-white/40">—</span>
                    ) : hasLoan ? (
                      <span className="rounded-full bg-status-late-soft dark:bg-status-late/20 px-2 py-px text-[10px] font-medium text-status-late dark:text-rose-400">
                        gizli — kreditli
                      </span>
                    ) : (
                      <span className="rounded-full bg-brand-green-mist dark:bg-brand-green/15 px-2 py-px text-[10px] font-medium text-status-paid dark:text-emerald-400">
                        görünür
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right align-middle">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      {isDirty(name) && (
                        <button
                          type="button"
                          onClick={() => save(name)}
                          disabled={pending}
                          className="rounded-lg bg-bank-blue px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-bank-blue-deep disabled:opacity-50"
                        >
                          Saxla
                        </button>
                      )}
                      {saved != null && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewName(previewName === name ? null : name)
                            }
                            disabled={pending}
                            className={`text-[11px] uppercase tracking-[0.12em] transition-colors ${
                              previewName === name
                                ? "text-bank-blue dark:text-blue-400"
                                : "text-black/40 hover:text-bank-blue dark:text-white/45 dark:hover:text-blue-400"
                            }`}
                          >
                            Bax
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(name)}
                            disabled={pending}
                            className="text-[11px] uppercase tracking-[0.12em] text-black/40 transition-colors hover:text-status-late dark:text-white/45 dark:hover:text-rose-400"
                          >
                            Sil
                          </button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bond-only holders have no sheet row — add their name by hand. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Cədvəldə olmayan ad (istiqraz sahibi)..."
          disabled={pending}
          className="w-64 rounded-lg border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 px-2.5 py-1.5 text-[12px] text-ink dark:text-white/90 outline-none focus:border-bank-blue/50"
        />
        <button
          type="button"
          disabled={pending || newName.trim().length === 0}
          onClick={() => {
            const n = newName.trim();
            if (n && !rows.includes(n)) setExtraNames((x) => [...x, n]);
            setNewName("");
          }}
          className="rounded-lg border border-black/10 dark:border-white/15 px-3 py-1.5 text-[12px] font-medium text-black/60 dark:text-white/70 transition hover:border-bank-blue/40 hover:text-bank-blue dark:hover:text-blue-400 disabled:opacity-50"
        >
          Sətir əlavə et
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-status-late dark:text-rose-400">{error}</p>
      )}

      {previewName != null && previewOffer != null && (
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/45">
            Önizləmə — {previewName} bunu görür
          </p>
          <CreditOfferBanner
            amountAzn={resolveAzn(previewOffer.mode, previewOffer.value)}
            minRatePct={minRatePct}
            preview
          />
        </div>
      )}
    </div>
  );
}
