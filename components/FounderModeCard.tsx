"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFounderMode } from "@/app/bank/founder-actions";

// İsmayıl's switch for Təsisçi rejimi. One global setting (fund_settings):
// on, the bank stops treating its owner as a customer everywhere — his
// deposit row is capital, his bonds are treasury paper, no daily interest
// accrues to him, and the bank-wide view splits his money out for every
// viewer.

export function FounderModeCard({ initialOn }: { initialOn: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initialOn);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !on;
    setError(null);
    setOn(next);
    startTransition(async () => {
      const res = await setFounderMode(next);
      if (!res.ok) {
        setOn(!next);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/90 p-5 dark:border-white/10 dark:bg-white/10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            Təsisçi rejimi
          </p>
          <p className="mt-1 text-sm font-medium text-ink dark:text-white/90">
            {on ? "Aktivdir — sən bankın təsisçisisən" : "Söndürülüb — sən adi depozitor kimi görünürsən"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Təsisçi rejimi"
          disabled={pending}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-bank-blue" : "bg-black/15 dark:bg-white/20"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              on ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <ul className="mt-3 space-y-1 text-[11px] leading-5 text-black/50 dark:text-white/55">
        <li>· Öz depozit sətrin kapital sayılır — ona günlük faiz hesablanmır.</li>
        <li>· Öz aldığın istiqrazlar xəzinə kağızıdır — kupon və nominal öhdəlik deyil.</li>
        <li>· Balans hesabatı və pul axını hamı üçün səni ayrıca «Təsisçi» kimi göstərir.</li>
        <li>· /bank səhifəndə depozit balansı əvəzinə təsisçi mövqeyi görünür.</li>
      </ul>
      {error ? (
        <p className="mt-2 text-[11px] text-status-late dark:text-rose-400">{error}</p>
      ) : null}
    </div>
  );
}
