"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExternalMember } from "@/app/bank/access-actions";
import type { AppUser } from "@/lib/access";

// İsmayıl's access panel: every login, with a switch between family and
// external member. An external member (someone outside the family who
// banks here) keeps the products — deposit, credit, bonds, İRF shares up
// to the external cap — but never sees the family views: the İRF portfolio
// and the bank-wide list of depositors and borrowers. Admin rows and
// İsmayıl's own row are shown but locked; the RPC refuses them too.

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  // Fixed Baku offset, no Intl — same hydration rule as the rest of /bank.
  const d = new Date(new Date(iso).getTime() + 4 * 3_600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

export function AccessPanel({
  users,
  selfId,
  externalCapPct,
}: {
  users: AppUser[];
  selfId: string;
  /** fund_config.external_cap_pct as a fraction (0.02 = 2%); null when the
   *  market is not configured yet. */
  externalCapPct: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const externalCount = users.filter((u) => u.external).length;
  const capLabel =
    externalCapPct != null
      ? `${String(Math.round(externalCapPct * 10000) / 100).replace(".", ",")}%`
      : "—";

  const onToggle = (u: AppUser) => {
    const next = !u.external;
    const label = u.displayName ?? u.email ?? u.userId;
    const question = next
      ? `${label}: kənar üzv edilsin? İRF portfeli və ümumbank baxışı bağlanacaq; pay alışı ümumi payların ${capLabel}-i ilə məhdudlaşacaq.`
      : `${label}: ailə üzvü edilsin? İRF portfeli və bütün bölmələr açılacaq, pay limiti götürüləcək.`;
    if (!window.confirm(question)) return;
    setError(null);
    setBusyId(u.userId);
    startTransition(async () => {
      const res = await setExternalMember(u.userId, next);
      setBusyId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
          Giriş hüquqları
        </p>
        <span className="text-[11px] text-black/45 dark:text-white/50">
          <span className="num">{users.length}</span> giriş ·{" "}
          <span className="num">{externalCount}</span> kənar üzv
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-black/45 dark:text-white/50">
        Kənar üzv depozit qoyur, kredit götürür, istiqraz və İRF payı alır —
        amma İRF portfelini və ümumbank baxışını görmür, pay alışı isə ümumi
        payların <span className="num">{capLabel}</span>-i ilə məhdudlaşır.
        Girişin adı bank cədvəlindəki adla eyni olmalıdır.
      </p>
      <div className="mt-3 divide-y divide-black/5 dark:divide-white/10">
        {users.map((u) => {
          const locked = u.isAdmin || u.userId === selfId;
          const busy = pending && busyId === u.userId;
          return (
            <div
              key={u.userId}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink dark:text-white/90">
                  {u.displayName ?? (
                    <span className="text-black/45 dark:text-white/50">
                      (ad yoxdur)
                    </span>
                  )}
                  {u.isAdmin ? (
                    <span className="ml-2 rounded-full border border-brand-green/30 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-green dark:text-emerald-400">
                      admin
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-black/45 dark:text-white/50">
                  {u.email ?? "—"} · son giriş:{" "}
                  <span className="num">{shortDate(u.lastSignInAt)}</span>
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={u.external}
                aria-label={`${u.displayName ?? u.email ?? ""}: kənar üzv`}
                disabled={locked || busy}
                onClick={() => onToggle(u)}
                className="group inline-flex shrink-0 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span
                  className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${
                    u.external
                      ? "text-bank-blue dark:text-blue-400"
                      : "text-black/45 dark:text-white/50"
                  }`}
                >
                  {busy ? "…" : u.external ? "Kənar üzv" : "Ailə üzvü"}
                </span>
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    u.external
                      ? "bg-bank-blue"
                      : "bg-black/15 dark:bg-white/15 group-hover:bg-black/25"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      u.external ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {error ? (
        <p className="mt-3 text-xs text-brand-red dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
