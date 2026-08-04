"use client";

import { useState, useTransition } from "react";
import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { scorePill } from "@/components/MomentumFactorTable";
import { CLOSE_CALL_GAP } from "@/lib/momentum";
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
import type { SellSignal, SellState } from "@/lib/sellSignals";

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
        {/* No dead "—" line while the budget is unset — the score carries
            the block; the amount joins it once there is one. */}
        {showAmount && (
          <span className="num w-full truncate text-center text-[11px] font-medium text-black/70 dark:text-white/75">
            <Masked mask="••••" className="text-black/40 dark:text-white/45">
              {formatAzn(pick.amountAzn)}
            </Masked>
          </span>
        )}
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

const fmtSignedPct = (v: number) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")}%`;

/** İZLƏ rows shown before the expander opens. SAT rows never collapse. */
const IZLE_VISIBLE = 5;

// Three-state condition mark: filled dot = condition fired, faint dot = in
// order, dash = unknown. Dots, not glyphs — İsmayıl's call — but "unknown"
// must stay distinguishable from "healthy": a holding with no 200-day
// history is not above it.
function ConditionDot({ state }: { state: boolean | null }) {
  if (state == null) {
    return (
      <span
        role="img"
        aria-label="məlumat yoxdur"
        className="text-[11px] text-black/20 dark:text-white/25"
      >
        —
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={state ? "şərt pozulub" : "qaydasındadır"}
      className={`inline-block h-[7px] w-[7px] rounded-full ${
        state
          ? "bg-brand-red/85 dark:bg-red-400/85"
          : "bg-black/10 dark:bg-white/15"
      }`}
    />
  );
}

/** ●●○ confirmation track: filled = observed periods, up to the SAT bar. */
function ProgressDots({ done, total }: { done: number; total: number }) {
  const filled = Math.min(done, total);
  return (
    <span
      role="img"
      aria-label={`${filled}/${total} təsdiq`}
      className="num text-[9px] tracking-[2px] text-brand-red/90 dark:text-red-400/90"
    >
      {"●".repeat(filled)}
      <span className="text-black/15 dark:text-white/20">
        {"●".repeat(Math.max(0, total - filled))}
      </span>
    </span>
  );
}

// One matrix row. P&L sits by the name (İsmayıl's "sell for profit" lens)
// but gates nothing; the ₼ part hides on phones, the % always shows. The
// confirmation track only renders when the core condition is live — a
// crash-only row is not on a path to SAT and must not imply one.
function SellRow({ signal }: { signal: SellSignal }) {
  const sat = signal.level === "sat";
  const CELL = "px-0.5 py-2 text-center align-baseline";
  const coreLive = signal.trendBroken === true && signal.momentumNeg === true;
  return (
    <tr className={`border-t border-[color:var(--glass-border)] ${sat ? "bg-brand-red/5" : ""}`}>
      {/* The table is table-fixed with widths on the header row; this column
          takes the remainder, and the overflow-hidden wrapper truncates the
          name instead of letting the ticker spill into the M/Z cell (auto
          layout squeezed this column below min-content). */}
      <td className="py-2 pr-1 align-baseline">
        <span className="flex min-w-0 max-w-full items-baseline gap-1 overflow-hidden sm:gap-1.5">
          {sat && (
            <span className="num shrink-0 rounded-md bg-brand-red/15 px-1.5 py-px text-[10px] font-bold tracking-wide text-brand-red dark:text-red-400">
              SAT
            </span>
          )}
          {/* min-w-0 + truncate (not shrink-0): a long ticker on a narrow
              phone ellipsizes instead of clipping mid-letter. The name gives
              way first via its larger shrink factor. */}
          <span
            className="num min-w-0 truncate text-sm font-semibold tracking-wide text-black/85 dark:text-white/90"
            title={signal.name}
          >
            {signal.symbol}
          </span>
          <span className="hidden min-w-0 shrink-[4] truncate text-[11px] text-black/45 dark:text-white/50 sm:inline">
            {signal.name}
          </span>
        </span>
      </td>
      <td
        className="whitespace-nowrap py-2 pr-1 text-right align-baseline"
        title="Orta alış qiymətinə görə"
      >
        {signal.plPct != null && (
          <>
            {signal.plAzn != null && (
              <span className="num hidden text-[10.5px] text-black/40 dark:text-white/45 sm:inline">
                <Masked mask="••••">{formatAzn(signal.plAzn)}</Masked>
                {" · "}
              </span>
            )}
            <span
              className={`num text-[11px] font-semibold ${
                signal.plPct >= 0
                  ? "text-brand-green dark:text-emerald-400"
                  : "text-brand-red dark:text-red-400"
              }`}
            >
              {/* Neutral mask colour — a green/red mask would leak the
                  profit/loss sign with the privacy eye on. */}
              <Masked
                mask="••••"
                className="text-black/40 dark:text-white/45"
              >
                {fmtSignedPct(signal.plPct)}
              </Masked>
            </span>
          </>
        )}
      </td>
      <td className={CELL}>
        <ConditionDot state={signal.trendBroken} />
      </td>
      <td className={CELL}>
        <ConditionDot state={signal.momentumNeg} />
      </td>
      <td className={CELL}>
        {signal.crash && signal.ret4w != null ? (
          <span className="num text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">
            {fmtSignedPct(signal.ret4w)}
          </span>
        ) : (
          <ConditionDot state={signal.ret4w == null ? null : false} />
        )}
      </td>
      <td className={CELL}>
        {coreLive ? (
          <ProgressDots
            done={signal.confirmedPeriods}
            total={signal.neededPeriods}
          />
        ) : (
          <span className="text-[11px] text-black/20 dark:text-white/25">—</span>
        )}
      </td>
    </tr>
  );
}

function SellSignals({
  sell,
  satCashAzn,
  showAmount,
}: {
  sell: SellState;
  /** The SAT-caused share of the unallocated budget (never the whole). */
  satCashAzn: number;
  showAmount: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const sat = sell.signals.filter((s) => s.level === "sat");
  const izle = sell.signals.filter((s) => s.level === "izle");
  const shown = expanded ? izle : izle.slice(0, IZLE_VISIBLE);
  const hidden = izle.slice(IZLE_VISIBLE);
  const below200 = sell.signals.filter((s) => s.trendBroken === true).length;
  const excluded = [...sell.confirmed];
  // No base alignment: `${TH} text-left` would LOSE to a base text-center —
  // conflicting Tailwind utilities resolve by stylesheet order, not by
  // className order, and .text-left is emitted before .text-center.
  const TH =
    "px-0.5 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-black/35 dark:text-white/40";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[10px] uppercase tracking-[0.22em] text-brand-red/70 dark:text-red-400/70">
          Satış siqnalları
        </span>
        {sell.signals.length > 0 && (
          <span className="num text-[10.5px] text-black/40 dark:text-white/45">
            {sat.length} SAT · {izle.length} İZLƏ · 200GO altında: {below200}
          </span>
        )}
      </div>
      {sell.signals.length === 0 ? (
        <p className="text-[11px] text-black/45 dark:text-white/50">
          Satış siqnalı yoxdur — bütün mövqelər trend qaydalarına uyğundur.
        </p>
      ) : (
        <>
          {/* table-fixed: column widths come from this header row — the
              symbol column takes the remainder. Auto layout would squeeze
              it below min-content on narrow cards. */}
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr>
                <th className={`${TH} text-left`}>Mövqe</th>
                <th className={`${TH} w-14 text-right sm:w-40`}>M/Z</th>
                <th className={`${TH} w-7 text-center sm:w-16`}>Trend</th>
                <th className={`${TH} w-8 text-center sm:w-16`}>
                  <span className="sm:hidden">Mom.</span>
                  <span className="hidden sm:inline">Momentum</span>
                </th>
                <th className={`${TH} w-12 text-center sm:w-16`}>4H</th>
                <th className={`${TH} w-8 text-center sm:w-16`}>Təsdiq</th>
              </tr>
            </thead>
            <tbody>
              {sat.map((s) => (
                <SellRow key={s.symbol} signal={s} />
              ))}
              {sat.length > 0 && shown.length > 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="pb-0.5 pt-2.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-black/30 dark:text-white/35"
                  >
                    İzlə{hidden.length > 0 && !expanded ? ` — ən ciddi ${IZLE_VISIBLE}` : ""}
                  </td>
                </tr>
              )}
              {shown.map((s) => (
                <SellRow key={s.symbol} signal={s} />
              ))}
            </tbody>
          </table>
          {hidden.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="w-fit text-[11px] text-black/50 transition-colors hover:text-black/80 dark:text-white/55 dark:hover:text-white/85"
            >
              {expanded ? (
                "Daha az göstər"
              ) : (
                <>
                  <span className="font-semibold">
                    + {hidden.length} siqnal daha göstər
                  </span>{" "}
                  — {hidden.map((s) => s.symbol).join(", ")}
                </>
              )}
            </button>
          )}
          <p className="text-[9.5px] leading-relaxed text-black/35 dark:text-white/40">
            ● şərt pozulub · solğun ● qaydasındadır · — məlumat yoxdur. Trend =
            qiymət 200 günlük ortalamaya nisbətən; Momentum = 13 həftəlik gəlir
            mənfi və ya S&P 500-dən geridə; 4H = son 4 həftədə −10%-dən dərin
            eniş; Təsdiq = ardıcıl {sell.rules.nounPlural.toLocaleLowerCase("az-AZ")} ({sell.rules.needed} = SAT) — yalnız Trend və Momentum birlikdə
            pozulanda sayılır, əks halda —.
          </p>
          {excluded.length > 0 && (
            <p className="text-[11px] leading-relaxed text-black/55 dark:text-white/60">
              SAT siqnallı {excluded.join(", ")} bu {sell.rules.noun} alışdan
              çıxarılıb
              {showAmount && satCashAzn > 0 ? (
                <>
                  {" "}
                  — <Masked mask="••••">{formatAzn(satCashAzn)}</Masked> nağd
                  qalır
                </>
              ) : null}
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}

// A SAT-blocked slot on the podium: dashed outline where the pick would
// stand, holding the cash instead. Dual momentum's "not this week" made
// visible in the same place the buy would have been — not a footnote two
// sections lower.
function GhostBlock({
  amountAzn,
  showAmount,
}: {
  amountAzn: number;
  showAmount: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
      <span aria-hidden className="h-6 w-6 shrink-0" />
      <div
        className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-t-xl border border-b-0 border-dashed border-brand-red/45 bg-brand-red/5 px-1.5 pb-2 pt-2 ${BLOCK_HEIGHT[3]}`}
      >
        <span className="text-[10px] font-bold tracking-[0.1em] text-brand-red/85 dark:text-red-400/85">
          SAT — BOŞ
        </span>
        {showAmount && amountAzn > 0 && (
          <span className="num w-full truncate text-center text-[10px] text-black/45 dark:text-white/55">
            <Masked mask="••••">{formatAzn(amountAzn)}</Masked> nağd qalır
          </span>
        )}
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
  sell,
  canEdit = false,
}: {
  ticket: BuyTicket;
  sell?: SellState;
  canEdit?: boolean;
}) {
  const { picks, advice, budgetAzn, unallocatedAzn } = ticket;
  if (picks.length === 0 && (sell == null || sell.signals.length === 0)) {
    return <div className="text-black/45 dark:text-white/50">Məlumat yoxdur.</div>;
  }

  const showAmount = budgetAzn > 0;
  const ticketSize = PODIUM_ORDER.length;
  // Only vacancies the SAT exclusion CAUSED become ghosts: without the
  // exclusion the board would have filled min(size, boardSize) slots, so
  // anything beyond that shortfall is a plain short-board vacancy and
  // collapses as before. The ghost carries only the SAT share of the cash;
  // the neutral note keeps the rest.
  const fillableSlots = Math.min(ticketSize, ticket.boardSize);
  const ghostCount =
    sell != null && sell.confirmed.size > 0
      ? Math.max(0, fillableSlots - picks.length)
      : 0;
  const vacancies = Math.max(0, ticketSize - picks.length);
  const satCashAzn =
    ghostCount === 0
      ? 0
      : ghostCount === vacancies
        ? unallocatedAzn
        : Math.min(
            unallocatedAzn,
            Math.round(((budgetAzn / ticketSize) * ghostCount) * 100) / 100,
          );
  const shortBoardCashAzn =
    Math.round((unallocatedAzn - satCashAzn) * 100) / 100;
  const bySlot = new Map(picks.map((p) => [p.slot, p]));
  // Podium slots left→right (3·1·2). A vacancy caused by a SAT exclusion
  // renders as a ghost block holding the unallocated cash (first ghost only);
  // a plain short-board vacancy just collapses as before.
  let ghostsLeft = ghostCount;
  let ghostAmountLeft = satCashAzn;
  const slots = PODIUM_ORDER.map((slot) => {
    const pick = bySlot.get(slot) ?? null;
    if (pick != null) return { slot, pick, ghostAmountAzn: 0 };
    if (ghostsLeft > 0) {
      ghostsLeft -= 1;
      const ghostAmountAzn = ghostAmountLeft;
      ghostAmountLeft = 0;
      return { slot, pick: null, ghostAmountAzn };
    }
    return null;
  }).filter((s): s is NonNullable<typeof s> => s != null);

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

      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-green/75 dark:text-emerald-400/75">
          Alış
        </span>
        <span className="num text-[10.5px] text-black/40 dark:text-white/45">
          {ticket.boardSize} mövqedən ilk {ticketSize}
          {ghostCount > 0 ? ` · ${ghostCount} slot SAT-la bağlı` : ""}
        </span>
      </div>

      {picks.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-black/55 dark:text-white/60">
          Bu {advice.rules.noun} üçün alış tövsiyəsi yoxdur — bütün seçimlər
          satış siqnalı altındadır.
        </p>
      ) : (
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-end gap-1.5 sm:gap-2">
            {slots.map((slot) =>
              slot.pick != null ? (
                <PodiumBlock
                  key={slot.pick.symbol}
                  pick={slot.pick}
                  showAmount={showAmount}
                />
              ) : (
                <GhostBlock
                  key={`ghost-${slot.slot}`}
                  amountAzn={slot.ghostAmountAzn}
                  showAmount={showAmount}
                />
              ),
            )}
          </div>
          <Pedestal />
        </div>
      )}

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
            <span className="num ml-auto shrink-0 text-[10px] text-black/40 dark:text-white/45">
              {pick.why.join(" · ")}
            </span>
          </li>
        ))}
      </ul>

      {/* One fragility note instead of a chip on every row. Careful copy:
          closeCall marks a pick near its board NEIGHBOUR — possibly an
          unadvised challenger — so "the picks are close to each other" would
          be a false claim. */}
      {picks.some((p) => p.closeCall) && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
          yaxın nəticə — ən azı bir seçim rəqibindən {CLOSE_CALL_GAP} baldan az
          fərqlənir, sıralama kövrəkdir
        </span>
      )}

      {/* The exclusion note inside SellSignals names the SAT-caused cash;
          this line keeps only the short-board share, so the two never
          mis-attribute each other's amount. */}
      {shortBoardCashAzn > 0 && showAmount && (
        <div className="num text-[11px] text-black/45 dark:text-white/50">
          <Masked mask="••••">{formatAzn(shortBoardCashAzn)}</Masked>{" "}
          bölüşdürülməyib
        </div>
      )}

      {sell != null && (
        <SellSignals
          sell={sell}
          satCashAzn={satCashAzn}
          showAmount={showAmount}
        />
      )}

      <div className="flex flex-col gap-1">
        <p className="text-[11px] leading-relaxed text-black/55 dark:text-white/60">
          {verdictSummary(advice)}
        </p>
        {/* The methodology folds away — the card is a decision surface, the
            rules are reference. The disclaimer never folds. */}
        <details className="group">
          {/* [&::-webkit-details-marker]:hidden — list-none alone leaves the
              native triangle in older Safari, doubling the chevron. */}
          <summary className="cursor-pointer list-none text-[10.5px] text-black/40 transition-colors hover:text-black/70 dark:text-white/45 dark:hover:text-white/75 [&::-webkit-details-marker]:hidden">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">
              ▸
            </span>
            Qaydalar və metodologiya
          </summary>
          <p className="mt-1.5 text-[10px] leading-relaxed text-black/40 dark:text-white/45">
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
            {sell != null
              ? `SAT siqnalı qiymət 200 günlük ortalamanın altına düşüb VƏ 13 həftəlik gəlir mənfi və ya S&P 500-dən geridə olanda, ${sell.rules.needed === 1 ? "ötən ayın ortalaması ilə təsdiqləndikdə" : `${sell.rules.needed} ${sell.rules.noun} ardıcıl təsdiqləndikdə`} yaranır; İZLƏ erkən xəbərdarlıqdır. Mənfəət/zərər orta alış qiymətinə görədir və siqnala təsir etmir. `
              : ""}
            {advice.periodsTracked} {advice.rules.adjective} məlumat əsasında.
          </p>
        </details>
        <p className="text-[9.5px] text-black/35 dark:text-white/40">
          İlkin hesablama, investisiya məsləhəti deyil.
        </p>
      </div>
    </div>
  );
}
