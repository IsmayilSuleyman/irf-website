"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveRegistration,
  linkRegistration,
  rejectRegistration,
} from "@/app/bank/registration-actions";
import type { AppUser, Registration } from "@/lib/access";

// İsmayıl's registration queue: every Google sign-in that typed Ad + Soyad
// on /register and is waiting. Each request is either LINKED to an existing
// profile (Subhan starts using his Google account: the Google identity moves
// onto his login, the placeholder is deleted) or CONFIRMED as a new account
// (name editable so it matches the bank sheet; usually an external member).

function shortDate(iso: string): string {
  // Fixed Baku offset, no Intl — same hydration rule as the rest of /bank.
  const d = new Date(new Date(iso).getTime() + 4 * 3_600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

type Mode = "new" | "link";

const fieldClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-ink dark:text-white/90 outline-none transition focus:border-brand-green";

function RegistrationRow({
  reg,
  profiles,
  onDone,
}: {
  reg: Registration;
  profiles: AppUser[];
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("new");
  const [fullName, setFullName] = useState(`${reg.firstName} ${reg.lastName}`);
  const [external, setExternal] = useState(true);
  const [targetId, setTargetId] = useState(profiles[0]?.userId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (
    question: string,
    action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>,
  ) => {
    if (!window.confirm(question)) return;
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone(res.message);
    });
  };

  const target = profiles.find((p) => p.userId === targetId);
  const targetLabel = target?.displayName ?? target?.email ?? "";

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-ink dark:text-white/90">
          {reg.firstName} {reg.lastName}
        </p>
        <p className="text-[11px] text-black/45 dark:text-white/50">
          {reg.email ?? "—"} · {reg.providers ?? "?"} ·{" "}
          <span className="num">{shortDate(reg.requestedAt)}</span>
        </p>
      </div>

      <div className="mt-3 flex gap-4 text-[11px]">
        {(
          [
            ["new", "Yeni hesab"],
            ["link", "Mövcud profilə bağla"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name={`mode-${reg.userId}`}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="accent-brand-green"
            />
            <span className="text-black/70 dark:text-white/75">{label}</span>
          </label>
        ))}
      </div>

      {mode === "new" ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-label="Girişin adı"
            maxLength={120}
            className={fieldClass}
          />
          <label className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-black/70 dark:text-white/75">
            <input
              type="checkbox"
              checked={external}
              onChange={(e) => setExternal(e.target.checked)}
              className="accent-bank-blue"
            />
            Kənar üzv
          </label>
          <button
            type="button"
            disabled={pending || fullName.trim() === ""}
            onClick={() =>
              run(
                `"${fullName.trim()}" adı ilə yeni giriş təsdiqlənsin${external ? " (kənar üzv)" : ""}? Ad bank cədvəlindəki adla eyni olmalıdır.`,
                () => approveRegistration(reg.userId, fullName, external),
              )
            }
            className="shrink-0 rounded-lg bg-brand-green px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-brand-green-soft disabled:opacity-50"
          >
            {pending ? "…" : "Təsdiqlə"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            aria-label="Mövcud profil"
            className={fieldClass}
          >
            {profiles.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.displayName ?? "(ad yoxdur)"}
                {p.email ? ` — ${p.email}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !target}
            onClick={() =>
              run(
                `${reg.email ?? "Bu Google girişi"} "${targetLabel}" profilinə bağlansın? Gözləyən giriş silinəcək; üzv Google ilə yenidən daxil olanda həmin profilə düşəcək.`,
                () => linkRegistration(reg.userId, targetId),
              )
            }
            className="shrink-0 rounded-lg bg-bank-blue px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "…" : "Bağla"}
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-3">
        {error ? (
          <p className="text-xs text-brand-red dark:text-red-400">{error}</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              `${reg.firstName} ${reg.lastName} (${reg.email ?? "—"}) sorğusu rədd edilsin? Giriş tamamilə silinəcək.`,
              () => rejectRegistration(reg.userId),
            )
          }
          className="text-[11px] font-medium text-brand-red/80 transition hover:text-brand-red dark:text-red-400/80 dark:hover:text-red-400 disabled:opacity-50"
        >
          Rədd et
        </button>
      </div>
    </div>
  );
}

export function RegistrationsPanel({
  registrations,
  profiles,
}: {
  registrations: Registration[];
  /** Approved logins (named) a request may be linked to. */
  profiles: AppUser[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const linkable = profiles.filter((p) => p.displayName != null);

  const onDone = (message: string) => {
    setNotice(message);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-brand-green/30 dark:border-emerald-400/30 bg-white/90 dark:bg-white/10 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-green dark:text-emerald-400">
          Qeydiyyat sorğuları
        </p>
        <span className="text-[11px] text-black/45 dark:text-white/50">
          <span className="num">{registrations.length}</span> gözləyir
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-black/45 dark:text-white/50">
        Google ilə daxil olub ad-soyadını yazanlar. Ailə üzvü öz Google
        hesabına keçirsə — mövcud profilinə bağla (tarixçəsi qalır). Yeni
        adamdırsa — adı cədvəldəki kimi yazıb təsdiqlə; adətən kənar üzv.
      </p>
      <div className="mt-2 divide-y divide-black/5 dark:divide-white/10">
        {registrations.map((reg) => (
          <RegistrationRow
            key={reg.userId}
            reg={reg}
            profiles={linkable}
            onDone={onDone}
          />
        ))}
      </div>
      {notice ? (
        <p className="mt-3 text-xs text-brand-green dark:text-emerald-400">{notice}</p>
      ) : null}
    </div>
  );
}
