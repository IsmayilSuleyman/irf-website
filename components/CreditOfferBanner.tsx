"use client";

import { useState } from "react";
import Link from "next/link";
import { formatGrouped, formatGroupedTrim } from "@/lib/portfolio";

// The personal credit-offer banner on /bank. The amount arrives resolved
// from the server (fixed AZN, or İsmayıl's percent rule against live
// liquidity); "Mənə maraqlıdır" pings İsmayıl once per day, "Hesabla" opens
// the credit calculator preset near the offered amount.

/** The credit calculator's slider ceiling — offers above it link without a
 *  preset instead of silently clamping to a smaller number. */
const CALCULATOR_MAX_AZN = 2000;

type PingState = "idle" | "pending" | "sent" | "already" | "error";

export function CreditOfferBanner({
  amountAzn,
  minRatePct,
  /** Renders the banner inert — İsmayıl's cabinet preview. */
  preview = false,
}: {
  amountAzn: number;
  minRatePct: number | null;
  preview?: boolean;
}) {
  const [state, setState] = useState<PingState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  async function onInterest() {
    if (state === "pending" || state === "sent" || state === "already") return;
    setState("pending");
    setServerError(null);
    try {
      const res = await fetch("/api/credit-offer-interest", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        already?: boolean;
        error?: string;
      };
      if (!res.ok) {
        // Surface the server's own Azerbaijani reason — a 404/409 is a
        // permanent answer that retrying can't change.
        setServerError(body.error ?? "Xəta baş verdi — yenidən cəhd edin.");
        setState("error");
        return;
      }
      setState(body.already ? "already" : "sent");
    } catch {
      setServerError("Şəbəkə xətası — yenidən cəhd edin.");
      setState("error");
    }
  }

  const pingLabel =
    state === "pending"
      ? "Göndərilir..."
      : state === "sent"
        ? "İsmayıla bildirildi ✓"
        : state === "already"
          ? "Artıq bildirilib ✓"
          : "Mənə maraqlıdır";

  const hesablaHref =
    amountAzn <= CALCULATOR_MAX_AZN
      ? `/ismayilbank?kredit=${amountAzn}#kredit`
      : "/ismayilbank#kredit";

  return (
    <section
      aria-label={preview ? "Banner önizləməsi" : undefined}
      className={`relative overflow-hidden rounded-2xl border border-bank-blue/30 dark:border-blue-400/30 bg-gradient-to-br from-bank-blue to-bank-blue-deep p-5 text-white sm:p-6 ${
        preview ? "pointer-events-none select-none" : ""
      }`}
    >
      <div
        aria-hidden
        className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
          Xüsusi təklif
        </p>
        <h2 className="mt-2 text-[clamp(1.25rem,3vw,1.6rem)] font-black tracking-[-0.03em]">
          Sizin üçün{" "}
          <span className="num whitespace-nowrap">
            {formatGrouped(amountAzn, 0)} ₼
          </span>{" "}
          kredit təklifimiz var!
        </h2>
        <p className="mt-1.5 text-[13px] leading-6 text-white/75">
          {minRatePct != null
            ? `İllik faiz ${formatGroupedTrim(minRatePct, 2)}%-dən başlayır. `
            : ""}
          Şərtləri kalkulyatorda hesablayın və ya birbaşa İsmayıla bildirin.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onInterest}
            disabled={preview || state === "pending"}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-90 ${
              state === "sent" || state === "already"
                ? "bg-white/20 text-white"
                : "bg-white text-bank-blue-deep hover:-translate-y-0.5 hover:bg-blue-50"
            }`}
          >
            {pingLabel}
          </button>
          <Link
            href={hesablaHref}
            tabIndex={preview ? -1 : undefined}
            className="rounded-xl border border-white/40 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            Hesabla
          </Link>
        </div>
        {serverError && (
          <p className="mt-2 text-[12px] text-amber-200">{serverError}</p>
        )}
      </div>
    </section>
  );
}
