"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { checkRegistration, submitRegistration } from "@/app/register/actions";
import type { AccessStatus } from "@/lib/access";

const POLL_MS = 20_000;

const inputClass =
  "border-b border-brand-green/30 bg-transparent px-0 py-2 text-black dark:text-white/90 outline-none transition focus:border-brand-green";
const labelClass =
  "text-[10px] uppercase tracking-[0.22em] text-black/45 dark:text-white/50";
const primaryClass =
  "rounded-xl bg-brand-green px-4 py-3 text-sm font-medium uppercase tracking-[0.18em] text-white shadow-glass-green transition hover:-translate-y-0.5 hover:bg-brand-green-soft disabled:opacity-60 disabled:hover:translate-y-0";
const secondaryClass =
  "rounded-xl border border-brand-green/20 bg-white/70 dark:bg-white/10 px-4 py-3 text-center text-sm font-medium uppercase tracking-[0.18em] text-black/70 dark:text-white/75 transition hover:-translate-y-0.5 hover:border-brand-green hover:text-brand-green dark:hover:text-emerald-400 disabled:opacity-60 disabled:hover:translate-y-0";

export function RegisterForm({
  status,
  email,
  firstName: initialFirst,
  lastName: initialLast,
}: {
  status: Exclude<AccessStatus, "approved">;
  email: string | null;
  firstName: string;
  lastName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(status === "unregistered");
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [checking, setChecking] = useState(false);

  // Once İsmayıl decides, this page finds out by itself. Approved → the
  // access token still carries no name, so refresh the session before
  // moving on. Linked to an existing profile → this placeholder login was
  // deleted with its session, so the member signs in again with Google and
  // lands in that profile.
  const check = async () => {
    setChecking(true);
    try {
      const res = await checkRegistration();
      if (res.status === "approved") {
        setApproved(true);
        const supabase = createSupabaseBrowserClient();
        if (supabase) await supabase.auth.refreshSession();
        router.push("/portal");
        router.refresh();
      } else if (res.status === "gone") {
        router.push("/login?next=/portal");
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (status !== "pending" || editing) return;
    const id = window.setInterval(() => {
      void check();
    }, POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, editing]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitRegistration(firstName, lastName);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const onLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const reveal = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: 0.1 },
  };

  if (approved) {
    return (
      <m.div {...reveal} className="flex flex-col gap-4 text-center">
        <h1 className="text-lg font-semibold text-ink dark:text-white/90">
          Giriş təsdiqləndi
        </h1>
        <p className="text-sm leading-6 text-black/55 dark:text-white/60">
          Portala keçid edilir…
        </p>
      </m.div>
    );
  }

  if (!editing) {
    return (
      <m.div {...reveal} className="flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-ink dark:text-white/90">
            Təsdiq gözlənilir
          </h1>
          <p className="mt-3 text-sm leading-6 text-black/55 dark:text-white/60">
            <span className="font-medium text-ink dark:text-white/90">
              {initialFirst} {initialLast}
            </span>
            {email ? (
              <>
                {" "}
                ({email})
              </>
            ) : null}{" "}
            üçün sorğu göndərildi. Admin təsdiqləyən kimi giriş açılacaq — bu
            səhifə özü yoxlayır, gözləmək kifayətdir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className={primaryClass}
        >
          {checking ? "Yoxlanılır..." : "İndi yoxla"}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={secondaryClass}
          >
            Adı düzəlt
          </button>
          <button type="button" onClick={onLogout} className={secondaryClass}>
            Çıxış
          </button>
        </div>
      </m.div>
    );
  }

  return (
    <m.form {...reveal} onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-ink dark:text-white/90">
          Qeydiyyat
        </h1>
        <p className="mt-3 text-sm leading-6 text-black/55 dark:text-white/60">
          {email ? (
            <>
              <span className="font-medium text-ink dark:text-white/90">{email}</span>{" "}
              ilə daxil oldunuz.{" "}
            </>
          ) : null}
          Davam etmək üçün adınızı və soyadınızı yazın — admin təsdiqləyəndən
          sonra giriş açılacaq.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="reg-first">
          Ad
        </label>
        <input
          id="reg-first"
          type="text"
          required
          autoComplete="given-name"
          maxLength={60}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="reg-last">
          Soyad
        </label>
        <input
          id="reg-last"
          type="text"
          required
          autoComplete="family-name"
          maxLength={60}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={inputClass}
        />
      </div>

      {error ? (
        <div className="text-xs text-brand-red dark:text-red-400">{error}</div>
      ) : null}

      <button type="submit" disabled={pending} className={`mt-2 ${primaryClass}`}>
        {pending ? "Göndərilir..." : "Göndər"}
      </button>
      <div className={status === "pending" ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
        {status === "pending" ? (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={secondaryClass}
          >
            Geriyə
          </button>
        ) : null}
        <button type="button" onClick={onLogout} className={secondaryClass}>
          Çıxış
        </button>
      </div>
    </m.form>
  );
}
