"use client";

import { useState, useTransition } from "react";
import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { scorePill } from "@/components/MomentumFactorTable";
import { SectorIcon } from "@/components/SectorIcon";
import { sectorColor } from "@/lib/sectorColors";
import { Masked } from "@/components/Masked";
import {
  savePurchaseCadence,
  saveWeeklyBudget,
} from "@/app/dashboard/budget-actions";
import {
  verdictSummary,
  type BuyTicket,
  type PurchaseCadence,
  type TicketPick,
  type Verdict,
} from "@/lib/buyTicket";

// This week's picks on a podium: the best-scoring pick raised in the centre
// with the runners-up flanking it, all standing on an elliptical pedestal.
// Heights encode the slot; the blocks carry the exact AZN amounts and the list
// under the pedestal spells out shares and the reason chips — the podium is a
// summary, never the only place a number appears.

const VERDICT_TONE: Record<Verdict, string> = {
  switch: "bg-brand-green/15 text-brand-green dark:text-emerald-400",
  hold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  seed: "bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/60",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  switch: "DƏYİŞDİ",
  hold: "SAXLA",
  seed: "BAŞLANĞIC",
};

// Left → right: 3rd, 1st, 2nd — the tallest block sits in the middle and the
// runner-up stands a step above third place.
const PODIUM_ORDER = [3, 1, 2] as const;

const BLOCK_HEIGHT: Record<number, string> = {
  1: "h-28 sm:h-32",
  2: "h-24 sm:h-28",
  3: "h-20 sm:h-24",
};

function PodiumBlock({
  pick,
  showAmount,
}: {
  pick: TicketPick;
  showAmount: boolean;
}) {
  const color = sectorColor(pick.sector);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}26`, color }}
      >
        <SectorIcon sector={pick.sector ?? ""} className="h-3.5 w-3.5" />
      </span>
      <div
        className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-t-xl border border-b-0 border-black/10 px-1.5 pb-2 pt-2 dark:border-white/15 ${BLOCK_HEIGHT[pick.slot] ?? BLOCK_HEIGHT[3]}`}
        style={{
          // Faint wash of the sector colour ties the block back to the pie.
          backgroundImage: `linear-gradient(to bottom, ${color}24, ${color}08)`,
        }}
      >
        <span className="num w-full truncate text-center text-xs font-semibold tracking-wide text-black/85 dark:text-white/90 sm:text-sm">
          {pick.symbol}
        </span>
        <span className="num w-full truncate text-center text-[11px] font-medium text-black/70 dark:text-white/75">
          {showAmount ? (
            <Masked mask="••••" className="text-black/40 dark:text-white/45">
              {formatAzn(pick.amountAzn)}
            </Masked>
          ) : (
            "—"
          )}
        </span>
        <span
          className={`num rounded-md px-1.5 py-px text-[10px] font-medium ${scorePill(pick.score)}`}
          title="Momentum balı"
        >
          {pick.score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function Pedestal() {
  return (
    <div className="relative h-7 w-full">
      {/* Side wall, then the top face: two offset ellipses give the disc its
          thickness. */}
      <div className="absolute inset-x-0 top-2 h-5 rounded-[50%] bg-black/[0.07] dark:bg-white/[0.07]" />
      <div className="absolute inset-x-0 top-0 h-5 rounded-[50%] border border-black/10 bg-white/80 dark:border-white/15 dark:bg-white/[0.09]" />
    </div>
  );
}

// Owner-only toggle between the weekly and monthly purchase cadence — the
// engine's decision periods and every line of copy follow it.
function CadenceToggle({ cadence }: { cadence: PurchaseCadence }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPick(next: PurchaseCadence) {
    if (next === cadence || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await savePurchaseCadence(next);
      if (!result.ok) setError(result.error ?? "Xəta baş verdi.");
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
        {(["weekly", "monthly"] as const).map((c) => (
          <button
            key={c}
            type="button"
            disabled={pending}
            onClick={() => onPick(c)}
            className={`px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${
              c === cadence
                ? "bg-brand-green/15 text-brand-green dark:text-emerald-400"
                : "text-black/45 hover:text-black/85 dark:text-white/50 dark:hover:text-white/90"
            }`}
          >
            {c === "weekly" ? "Həftəlik" : "Aylıq"}
          </button>
        ))}
      </span>
      {error && (
        <span className="text-[10px] text-brand-red dark:text-red-400">{error}</span>
      )}
    </span>
  );
}

function BudgetLine({
  budgetAzn,
  canEdit,
  cadence,
}: {
  budgetAzn: number;
  canEdit: boolean;
  cadence: PurchaseCadence;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(budgetAzn > 0 ? String(budgetAzn) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const budgetLabel = cadence === "monthly" ? "Aylıq büdcə" : "Həftəlik büdcə";

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveWeeklyBudget(draft);
      if (!result.ok) {
        setError(result.error ?? "Xəta baş verdi.");
        return;
      }
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-black/45 dark:text-white/50">
            {budgetLabel}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="300"
            disabled={pending}
            className="num w-28 rounded-lg border border-black/10 bg-white/60 px-2 py-1 text-sm text-black/85 outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30 dark:border-white/15 dark:bg-white/5 dark:text-white/90"
          />
          <span className="num text-sm text-black/45 dark:text-white/50">₼</span>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="rounded-md bg-brand-green px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-green-deep disabled:opacity-50"
          >
            {pending ? "Saxlanılır..." : "Yadda saxla"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-xs text-black/55 transition-colors hover:text-black/85 disabled:opacity-50 dark:text-white/60 dark:hover:text-white/90"
          >
            Ləğv et
          </button>
        </div>
        {error && (
          <div className="text-xs text-brand-red dark:text-red-400">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-[11px] text-black/45 dark:text-white/50">
        {budgetLabel}
      </span>
      {budgetAzn > 0 ? (
        <span className="num text-sm font-semibold text-black/85 dark:text-white/90">
          <Masked mask="••••">{formatAzn(budgetAzn)}</Masked>
        </span>
      ) : (
        <span className="text-[11px] text-black/45 dark:text-white/50">
          təyin edilməyib
        </span>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] uppercase tracking-[0.18em] text-brand-green transition-colors hover:text-brand-green-deep dark:text-emerald-400"
        >
          {budgetAzn > 0 ? "Redaktə et" : "Təyin et"}
        </button>
      )}
      {canEdit && <CadenceToggle cadence={cadence} />}
    </div>
  );
}

export function BuyTicketPodium({
  ticket,
  canEdit = false,
}: {
  ticket: BuyTicket;
  canEdit?: boolean;
}) {
  const { picks, advice, budgetAzn, unallocatedAzn } = ticket;
  if (picks.length === 0) {
    return <div className="text-black/45 dark:text-white/50">Məlumat yoxdur.</div>;
  }

  const showAmount = budgetAzn > 0;
  const bySlot = new Map(picks.map((p) => [p.slot, p]));
  const ordered = PODIUM_ORDER.map((slot) => bySlot.get(slot)).filter(
    (p): p is TicketPick => p != null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          {advice.cadence === "monthly"
            ? "Aylıq Alış Bileti"
            : "Həftəlik Alış Bileti"}
        </div>
        <span
          className={`num rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${VERDICT_TONE[advice.verdict]}`}
        >
          {VERDICT_LABEL[advice.verdict]}
        </span>
      </div>

      <BudgetLine
        budgetAzn={budgetAzn}
        canEdit={canEdit}
        cadence={advice.cadence}
      />

      <div className="mx-auto w-full max-w-sm">
        <div className="flex items-end gap-1.5 sm:gap-2">
          {ordered.map((pick) => (
            <PodiumBlock
              key={pick.symbol}
              pick={pick}
              showAmount={showAmount}
            />
          ))}
        </div>
        <Pedestal />
      </div>

      {/* Exact figures per pick: amount, shares, and why it is here. */}
      <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        {picks.map((pick) => (
          <li
            key={pick.symbol}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2"
          >
            <span className="num w-4 shrink-0 text-xs text-black/45 dark:text-white/55">
              {pick.slot}
            </span>
            <span className="num shrink-0 text-sm font-semibold tracking-wide text-black/85 dark:text-white/90">
              {pick.symbol}
            </span>
            <span className="min-w-0 truncate text-[11px] text-black/45 dark:text-white/50">
              {pick.name}
            </span>
            {showAmount && (
              <span className="num shrink-0 text-[11px] font-medium text-black/70 dark:text-white/75">
                <Masked mask="••••">{formatAzn(pick.amountAzn)}</Masked>
              </span>
            )}
            {showAmount && pick.shares != null && (
              <span className="num shrink-0 text-[11px] text-black/45 dark:text-white/50">
                <Masked mask="••••">
                  {`≈${formatGroupedTrim(pick.shares, 4)} pay`}
                </Masked>
              </span>
            )}
            {pick.closeCall && (
              <span
                title="Yaxın nəticə — sıralama bu həftə kövrəkdir"
                className="rounded-full border border-amber-500/40 px-1.5 py-px text-[10px] font-medium text-amber-600 dark:text-amber-400"
              >
                yaxın nəticə
              </span>
            )}
            <span className="num ml-auto shrink-0 text-[10px] text-black/40 dark:text-white/45">
              {pick.why.join(" · ")}
            </span>
          </li>
        ))}
      </ul>

      {unallocatedAzn > 0 && (
        <div className="num text-[11px] text-black/45 dark:text-white/50">
          <Masked mask="••••">{formatAzn(unallocatedAzn)}</Masked> bölüşdürülməyib
        </div>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-[11px] leading-relaxed text-black/55 dark:text-white/60">
          {verdictSummary(advice)}
        </p>
        <p className="text-[10px] leading-relaxed text-black/40 dark:text-white/45">
          Büdcə seçimlər arasında bərabər bölünür.{" "}
          {advice.rules.needed === 1
            ? `Seçim yalnız yeni namizəd ötən ayın ortalamasında ən azı ${formatGroupedTrim(advice.leadThreshold, 1)} bal öndə olanda dəyişir`
            : `Seçim yalnız yeni namizəd ${advice.rules.needed} ${advice.rules.noun} ardıcıl ən azı ${formatGroupedTrim(advice.leadThreshold, 1)} bal öndə olanda dəyişir`}{" "}
          — fərq həddi portfeldəki mövqe sayına uyğunlaşır, bu da{" "}
          {advice.rules.adjective} səs-küydə tövsiyənin ora-bura atılmasının
          qarşısını alır.{" "}
          {advice.cadence === "monthly"
            ? "Aylıq qiymətləndirmə həftəlik balların ortalamasına əsaslanır. "
            : ""}
          {advice.periodsTracked} {advice.rules.adjective} məlumat əsasında.
          İlkin hesablama, investisiya məsləhəti deyil.
        </p>
      </div>
    </div>
  );
}
