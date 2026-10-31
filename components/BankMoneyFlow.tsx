"use client";

import { useMemo, useState } from "react";
import { formatAzn, formatGrouped } from "@/lib/portfolio";
import { toTitleCaseAz } from "@/lib/user";
import {
  FLOW_CHANNEL_LABEL,
  summarizeMoneyFlow,
  type FlowChannel,
  type FlowEvent,
} from "@/lib/bankFlows";

// Pul axını — Design B, the flow map: where the bank's money comes from and
// where it sits as a Sankey (every ribbon labelled with its exact ₼), then
// one card per channel with the period's in/out and a day-by-day bar strip,
// and finally every single movement, folded under "Bütün hərəkətlər". The
// period chips filter the cards and the ledger; the map is today's stock.
// In founder mode the Təsisçi ribbon is highlighted and the centre node
// reads the founder's capital, net position and monthly margin.

export type FlowMapNode = {
  key: string;
  label: string;
  amountAzn: number;
  /** Fill tone — kept to the balance sheet's own bar classes. */
  tone: "blue" | "blue60" | "blue35" | "late" | "green" | "founder";
  hint?: string;
};

export type FlowMapFounder = {
  capitalAzn: number;
  equityAzn: number;
  monthlyMarginAzn: number;
};

export type FlowMap = {
  sources: FlowMapNode[];
  uses: FlowMapNode[];
  totalAzn: number;
  founder: FlowMapFounder | null;
};

type Period = "30" | "90" | "all";

const TONE_FILL: Record<FlowMapNode["tone"], string> = {
  blue: "fill-bank-blue",
  blue60: "fill-bank-blue/60",
  blue35: "fill-bank-blue/35",
  late: "fill-status-late/70",
  green: "fill-brand-green",
  founder: "fill-bank-blue-deep dark:fill-blue-400",
};
const TONE_BG: Record<FlowMapNode["tone"], string> = {
  blue: "bg-bank-blue",
  blue60: "bg-bank-blue/60",
  blue35: "bg-bank-blue/35",
  late: "bg-status-late/70",
  green: "bg-brand-green",
  founder: "bg-bank-blue-deep dark:bg-blue-400",
};

const CHANNEL_DOT: Record<FlowChannel, string> = {
  deposit: "bg-bank-blue",
  credit: "bg-status-late/80",
  bond: "bg-sky-400",
  interest: "bg-brand-green",
  reward: "bg-amber-500",
  asset: "bg-bank-blue/35",
  founder: "bg-bank-blue-deep dark:bg-blue-400",
};

const AZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];
function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${AZ_MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${(AZ_MONTHS[Number(m[2]) - 1] ?? m[2]).slice(0, 3)}`;
}
function shiftIso(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
const signed = (n: number) =>
  `${n < 0 ? "−" : "+"}${formatAzn(Math.abs(n))}`;

// === The Sankey (≥ sm) ===================================================

const W = 720;
const BAR_H = 190; // total ribbon height the sources/uses share
const GAP = 12;
const LX = 196; // left bars' right edge
const CX0 = 300; // centre node
const CX1 = 420;
const RX = 524; // right bars' left edge
const MIN_H = 3;

type Placed = FlowMapNode & { y: number; h: number };

// Every node gets at least a label's worth of vertical room (two 12px
// lines), so a 32 ₼ reserve next to a 1.500 ₼ deposit still reads; the
// bar itself stays proportional, centred in its slot.
const LABEL_H = 30;

function place(nodes: FlowMapNode[], total: number, top: number): { placed: Placed[]; height: number } {
  const visible = nodes.filter((n) => n.amountAzn > 0.005);
  let y = top;
  const placed: Placed[] = visible.map((n) => {
    const h = Math.max(MIN_H, total > 0 ? (n.amountAzn / total) * BAR_H : 0);
    const slot = Math.max(h, LABEL_H);
    const p = { ...n, y: y + (slot - h) / 2, h };
    y += slot + GAP;
    return p;
  });
  return { placed, height: y - top - GAP };
}

function ribbon(x1: number, y1: number, h1: number, x2: number, y2: number, h2: number): string {
  const mx = (x1 + x2) / 2;
  return [
    `M${x1} ${y1}`,
    `C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
    `L${x2} ${y2 + h2}`,
    `C${mx} ${y2 + h2}, ${mx} ${y1 + h1}, ${x1} ${y1 + h1}`,
    "Z",
  ].join(" ");
}

function FlowSankey({ map }: { map: FlowMap }) {
  const L = place(map.sources, map.totalAzn, 0);
  const R = place(map.uses, map.totalAzn, 0);
  const H = Math.max(L.height, R.height, 120);
  const lOff = (H - L.height) / 2;
  const rOff = (H - R.height) / 2;
  // Centre node: the ribbons stack with no gaps on its edges.
  const cH = Math.max(
    L.placed.reduce((s, p) => s + p.h, 0),
    R.placed.reduce((s, p) => s + p.h, 0),
    64,
  );
  const cY = (H - cH) / 2;
  let lc = cY;
  let rc = cY;
  const PAD = 8;

  return (
    <svg
      viewBox={`0 0 ${W} ${H + PAD * 2}`}
      className="h-auto w-full"
      role="img"
      aria-label="Pul axını xəritəsi"
    >
      <g transform={`translate(0 ${PAD})`}>
        {/* Sources → centre */}
        {L.placed.map((p) => {
          const y = p.y + lOff;
          const path = ribbon(LX, y, p.h, CX0, lc, p.h);
          lc += p.h;
          return (
            <g key={`s-${p.key}`}>
              <path d={path} className={`${TONE_FILL[p.tone]} opacity-20`} />
              <rect x={LX - 6} y={y} width={6} height={p.h} rx={1.5} className={TONE_FILL[p.tone]} />
              <text
                x={LX - 14}
                y={y + p.h / 2 - 3}
                textAnchor="end"
                className="fill-ink text-[12px] font-medium dark:fill-white/90"
              >
                {p.label}
              </text>
              <text
                x={LX - 14}
                y={y + p.h / 2 + 11}
                textAnchor="end"
                className="num fill-ink text-[12px] font-semibold tabular-nums dark:fill-white/90"
              >
                {formatAzn(p.amountAzn)}
              </text>
            </g>
          );
        })}
        {/* Centre → uses */}
        {R.placed.map((p) => {
          const y = p.y + rOff;
          const path = ribbon(CX1, rc, p.h, RX, y, p.h);
          rc += p.h;
          return (
            <g key={`u-${p.key}`}>
              <path d={path} className={`${TONE_FILL[p.tone]} opacity-20`} />
              <rect x={RX} y={y} width={6} height={p.h} rx={1.5} className={TONE_FILL[p.tone]} />
              <text
                x={RX + 14}
                y={y + p.h / 2 - 3}
                className="fill-ink text-[12px] font-medium dark:fill-white/90"
              >
                {p.label}
              </text>
              <text
                x={RX + 14}
                y={y + p.h / 2 + 11}
                className="num fill-ink text-[12px] font-semibold tabular-nums dark:fill-white/90"
              >
                {formatAzn(p.amountAzn)}
              </text>
            </g>
          );
        })}
        {/* The bank */}
        <rect
          x={CX0}
          y={cY}
          width={CX1 - CX0}
          height={cH}
          rx={12}
          className="fill-bank-blue-soft stroke-bank-blue/30 dark:fill-bank-blue/20 dark:stroke-blue-400/40"
          strokeWidth={1}
        />
        {map.founder ? (
          <>
            <text x={(CX0 + CX1) / 2} y={cY + cH / 2 - 26} textAnchor="middle" className="fill-bank-blue text-[9px] font-semibold uppercase tracking-[0.18em] dark:fill-blue-400">
              Təsisçi rejimi
            </text>
            <text x={(CX0 + CX1) / 2} y={cY + cH / 2 - 10} textAnchor="middle" className="num fill-ink text-[13px] font-bold tabular-nums dark:fill-white/95">
              {formatAzn(map.founder.capitalAzn)}
            </text>
            <text x={(CX0 + CX1) / 2} y={cY + cH / 2 + 3} textAnchor="middle" className="fill-black/50 text-[9px] dark:fill-white/55">
              kapital
            </text>
            <text x={(CX0 + CX1) / 2} y={cY + cH / 2 + 18} textAnchor="middle" className={`num text-[11px] font-semibold tabular-nums ${map.founder.equityAzn >= 0 ? "fill-brand-green-deep dark:fill-emerald-400" : "fill-status-late dark:fill-rose-400"}`}>
              xalis {formatAzn(map.founder.equityAzn)}
            </text>
            <text x={(CX0 + CX1) / 2} y={cY + cH / 2 + 32} textAnchor="middle" className={`num text-[10px] font-medium tabular-nums ${map.founder.monthlyMarginAzn >= 0 ? "fill-brand-green-deep dark:fill-emerald-400" : "fill-status-late dark:fill-rose-400"}`}>
              marja {signed(map.founder.monthlyMarginAzn)}/ay
            </text>
          </>
        ) : (
          <>
            <text x={(CX0 + CX1) / 2} y={cY + cH / 2 - 6} textAnchor="middle" className="fill-bank-blue text-[10px] font-semibold uppercase tracking-[0.18em] dark:fill-blue-400">
              İsmayılBank
            </text>
            <text x={(CX0 + CX1) / 2} y={cY + cH / 2 + 12} textAnchor="middle" className="num fill-ink text-[13px] font-bold tabular-nums dark:fill-white/95">
              {formatAzn(map.totalAzn)}
            </text>
          </>
        )}
      </g>
    </svg>
  );
}

// === The phone version: two segmented bars with exact legends. ===========

function FlowBars({ map }: { map: FlowMap }) {
  const Bar = ({ title, nodes }: { title: string; nodes: FlowMapNode[] }) => {
    const visible = nodes.filter((n) => n.amountAzn > 0.005);
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
          {title}
        </p>
        <div className="mt-2 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/10" aria-hidden>
          {visible.map((n) => (
            <span
              key={n.key}
              className={`h-full ${TONE_BG[n.tone]}`}
              style={{ width: `${map.totalAzn > 0 ? Math.max(1.5, (n.amountAzn / map.totalAzn) * 100) : 0}%` }}
            />
          ))}
        </div>
        <ul className="mt-2 space-y-1">
          {visible.map((n) => (
            <li key={n.key} className="flex items-center justify-between gap-3 text-[12px]">
              <span className="flex items-center gap-2 text-black/60 dark:text-white/65">
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${TONE_BG[n.tone]}`} />
                {n.label}
              </span>
              <span className="num font-semibold tabular-nums text-ink dark:text-white/90">
                {formatAzn(n.amountAzn)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <div className="space-y-5">
      <Bar title="Mənbələr" nodes={map.sources} />
      <div className="rounded-xl bg-bank-blue-soft px-4 py-3 text-center dark:bg-bank-blue/15">
        {map.founder ? (
          <>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-bank-blue dark:text-blue-400">
              Təsisçi rejimi · kapital
            </p>
            <p className="num mt-0.5 text-lg font-bold tabular-nums text-ink dark:text-white/95">
              {formatAzn(map.founder.capitalAzn)}
            </p>
            <p className="num text-[11px] font-medium tabular-nums text-black/55 dark:text-white/60">
              xalis {formatAzn(map.founder.equityAzn)} · marja {signed(map.founder.monthlyMarginAzn)}/ay
            </p>
          </>
        ) : (
          <>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-bank-blue dark:text-blue-400">
              İsmayılBank
            </p>
            <p className="num mt-0.5 text-lg font-bold tabular-nums text-ink dark:text-white/95">
              {formatAzn(map.totalAzn)}
            </p>
          </>
        )}
      </div>
      <Bar title="Yerləşdirmə" nodes={map.uses} />
    </div>
  );
}

// === Channel cards with a day-by-day strip ===============================

function DayStrip({
  values,
  tone,
}: {
  values: { key: string; label: string; v: number }[];
  /** "flow" draws + up / − down; "accrual" draws one-sided blue bars. */
  tone: "flow" | "accrual";
}) {
  const max = Math.max(...values.map((d) => Math.abs(d.v)), 0.0001);
  const H = 34;
  const mid = tone === "flow" ? H / 2 : H;
  const w = 100 / values.length;
  return (
    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="mt-3 h-9 w-full" aria-hidden>
      {tone === "flow" ? (
        <line x1="0" x2="100" y1={mid} y2={mid} className="stroke-black/10 dark:stroke-white/15" strokeWidth="0.5" />
      ) : null}
      {values.map((d, i) => {
        if (Math.abs(d.v) < 0.005) return null;
        const h = Math.max(1, (Math.abs(d.v) / max) * (tone === "flow" ? H / 2 - 1 : H - 1));
        const y = d.v >= 0 ? mid - h : mid;
        const cls =
          tone === "accrual"
            ? "fill-brand-green/70"
            : d.v >= 0
              ? "fill-brand-green"
              : "fill-status-late/80";
        return (
          <rect key={d.key} x={i * w + w * 0.15} y={y} width={w * 0.7} height={h} className={cls}>
            <title>{`${d.label}: ${signed(d.v)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function ChannelCard({
  channel,
  events,
  fromIso,
  todayIso,
}: {
  channel: FlowChannel;
  events: FlowEvent[];
  fromIso: string | null;
  todayIso: string;
}) {
  const mine = events.filter((e) => e.channel === channel && (!fromIso || e.date >= fromIso));
  const cash = mine.filter((e) => e.kind === "cash");
  const accrual = mine.filter((e) => e.kind === "accrual");
  const inAzn = cash.reduce((s, e) => s + (e.amountAzn > 0 ? e.amountAzn : 0), 0);
  const outAzn = cash.reduce((s, e) => s + (e.amountAzn < 0 ? -e.amountAzn : 0), 0);
  const accruedAzn = accrual.reduce((s, e) => s + e.amountAzn, 0);
  const isAccrual = channel === "interest" || channel === "reward";

  // Buckets: one per day for ≤ 100 days, else one per week. The window's
  // start is the period start, or the oldest event for "Hamısı".
  const start = fromIso ?? (mine.length > 0 ? mine[mine.length - 1].date : todayIso);
  const spanDays = Math.max(1, Math.round((new Date(`${todayIso}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000) + 1);
  const bucketDays = spanDays > 100 ? 7 : 1;
  const nBuckets = Math.ceil(spanDays / bucketDays);
  const buckets = Array.from({ length: nBuckets }, (_, i) => {
    const from = shiftIso(start, i * bucketDays);
    return { key: from, label: bucketDays === 1 ? shortDate(from) : `${shortDate(from)} həftəsi`, v: 0 };
  });
  for (const e of isAccrual ? accrual : cash) {
    const idx = Math.floor((new Date(`${e.date}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000 / bucketDays);
    if (idx >= 0 && idx < nBuckets) buckets[idx].v += e.amountAzn;
  }

  return (
    <div className="min-w-0 rounded-card border border-black/10 bg-white/80 px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
        <span aria-hidden className={`h-2 w-2 rounded-full ${CHANNEL_DOT[channel]}`} />
        {FLOW_CHANNEL_LABEL[channel]}
      </p>
      {isAccrual ? (
        <>
          <p className="num mt-1.5 text-[1.1rem] font-semibold tabular-nums tracking-[-0.02em] text-ink dark:text-white/90">
            +{formatAzn(accruedAzn)}
          </p>
          <p className="mt-0.5 text-[10px] text-black/40 dark:text-white/45">
            hesablanıb · {accrual.length} qeyd
          </p>
        </>
      ) : (
        <>
          <p className="num mt-1.5 text-[13px] font-semibold tabular-nums text-brand-green-deep dark:text-emerald-400">
            +{formatAzn(inAzn)}
          </p>
          <p className="num text-[13px] font-semibold tabular-nums text-status-late dark:text-rose-400">
            −{formatAzn(outAzn)}
          </p>
          <p className="mt-0.5 text-[10px] text-black/40 dark:text-white/45">
            xalis {signed(inAzn - outAzn)} · {cash.length} hərəkət
          </p>
        </>
      )}
      {mine.length > 0 ? (
        <DayStrip values={buckets} tone={isAccrual ? "accrual" : "flow"} />
      ) : (
        <p className="mt-3 h-9 text-[10px] leading-9 text-black/35 dark:text-white/40">bu dövrdə hərəkət yoxdur</p>
      )}
    </div>
  );
}

// === The ledger ==========================================================

function LedgerRow({ e }: { e: FlowEvent }) {
  const pill =
    e.kind === "accrual"
      ? { text: "hesablanıb", cls: "bg-brand-green-mist text-brand-green-deep dark:bg-brand-green/15 dark:text-emerald-400" }
      : e.kind === "transfer"
        ? { text: e.founder ? "daxili" : "köçürmə", cls: "bg-black/[0.05] text-black/55 dark:bg-white/10 dark:text-white/60" }
        : null;
  const amountCls =
    e.kind === "cash"
      ? e.amountAzn >= 0
        ? "text-brand-green-deep dark:text-emerald-400"
        : "text-status-late dark:text-rose-400"
      : "text-black/50 dark:text-white/55";
  const amountText =
    e.kind === "transfer" ? formatAzn(Math.abs(e.amountAzn)) : signed(e.amountAzn);
  return (
    <div className="flex items-start gap-3 px-5 py-2.5 sm:px-6">
      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CHANNEL_DOT[e.channel]}`} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-medium text-ink dark:text-white/90">
          <span className="truncate">{e.label}</span>
          {e.person ? (
            <span className="truncate text-black/55 dark:text-white/60">— {toTitleCaseAz(e.person)}</span>
          ) : null}
          {e.founder ? (
            <span className="rounded-full bg-bank-blue-soft px-2 py-0.5 text-[10px] font-semibold text-bank-blue dark:bg-bank-blue/20 dark:text-blue-400">
              Təsisçi
            </span>
          ) : null}
          {pill ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill.cls}`}>{pill.text}</span>
          ) : null}
        </p>
        {e.hint ? (
          <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/50">{e.hint}</p>
        ) : null}
      </div>
      <p className={`num shrink-0 text-[13px] font-semibold tabular-nums ${amountCls}`}>{amountText}</p>
    </div>
  );
}

const PAGE = 40;

export function BankMoneyFlow({
  events,
  map,
  partial,
  todayIso,
}: {
  events: FlowEvent[];
  map: FlowMap;
  /** Non-admin session: Supabase ledgers show the viewer's own rows only. */
  partial: boolean;
  todayIso: string;
}) {
  const [period, setPeriod] = useState<Period>("30");
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const fromIso = period === "all" ? null : shiftIso(todayIso, -(Number(period) - 1));
  const summary = useMemo(() => summarizeMoneyFlow(events, fromIso), [events, fromIso]);
  const inWindow = useMemo(
    () => events.filter((e) => !fromIso || e.date >= fromIso),
    [events, fromIso],
  );
  const channels: FlowChannel[] = [
    "deposit",
    "credit",
    "bond",
    "interest",
    "reward",
    "asset",
    ...(map.founder ? (["founder"] as FlowChannel[]) : []),
  ];

  // Day groups for the visible slice.
  const visible = inWindow.slice(0, limit);
  const groups: { date: string; rows: FlowEvent[] }[] = [];
  for (const e of visible) {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.rows.push(e);
    else groups.push({ date: e.date, rows: [e] });
  }

  return (
    <section
      id="pul-axini"
      className="scroll-mt-6 rounded-hero border border-black/10 bg-white/90 dark:border-white/10 dark:bg-white/10"
    >
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-6 pt-6 sm:px-7">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            Pul axını
          </p>
          <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
            Hər qəpiyin yolu
          </h2>
          <p className="mt-0.5 text-xs text-black/45 dark:text-white/50">
            xəritə bu günkü balansdır; kartlar və siyahı seçilmiş dövrün hərəkətləridir
          </p>
        </div>
        <div role="tablist" aria-label="Dövr" className="flex gap-1 rounded-full border border-black/10 bg-white/70 p-0.5 dark:border-white/10 dark:bg-white/5">
          {(
            [
              ["30", "30 gün"],
              ["90", "90 gün"],
              ["all", "Hamısı"],
            ] as [Period, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={period === key}
              onClick={() => {
                setPeriod(key);
                setLimit(PAGE);
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                period === key
                  ? "bg-bank-blue text-white"
                  : "text-black/55 hover:text-bank-blue dark:text-white/60 dark:hover:text-blue-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* The map */}
      <div className="px-6 pt-5 sm:px-7">
        <div className="hidden sm:block">
          <FlowSankey map={map} />
        </div>
        <div className="sm:hidden">
          <FlowBars map={map} />
        </div>
        {map.founder ? (
          <p className="mt-2 text-[11px] leading-5 text-black/45 dark:text-white/50">
            Təsisçi rejimi: İsmayılın öz depoziti və öz istiqrazları kapital
            kimi göstərilir — kənar iştirakçıların vəsaiti ayrıca sayılır.
          </p>
        ) : null}
      </div>

      {/* Period totals */}
      <div className="mx-6 mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-black/10 pt-5 dark:border-white/10 sm:mx-7">
        {[
          { label: "Giriş", value: `+${formatAzn(summary.inAzn)}`, cls: "text-brand-green-deep dark:text-emerald-400" },
          { label: "Çıxış", value: `−${formatAzn(summary.outAzn)}`, cls: "text-status-late dark:text-rose-400" },
          { label: "Xalis", value: signed(summary.netAzn), cls: summary.netAzn >= 0 ? "text-ink dark:text-white/90" : "text-status-late dark:text-rose-400" },
          { label: "Hesablanmış faiz və mükafat", value: `+${formatAzn(summary.accruedAzn)}`, cls: "text-black/60 dark:text-white/65" },
        ].map((t) => (
          <div key={t.label}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
              {t.label}
            </p>
            <p className={`num mt-1 text-[15px] font-semibold tabular-nums ${t.cls}`}>{t.value}</p>
          </div>
        ))}
      </div>

      {/* Channel cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-6 sm:grid-cols-3 sm:px-7">
        {channels.map((c) => (
          <ChannelCard key={c} channel={c} events={events} fromIso={fromIso} todayIso={todayIso} />
        ))}
      </div>

      {/* The ledger, folded */}
      <div className="mt-6 border-t border-black/10 dark:border-white/10">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left sm:px-7"
        >
          <span className="text-[13px] font-semibold text-ink dark:text-white/90">
            Bütün hərəkətlər{" "}
            <span className="num text-black/45 dark:text-white/50">({inWindow.length})</span>
          </span>
          <span aria-hidden className={`text-black/45 transition dark:text-white/50 ${open ? "rotate-90" : ""}`}>
            ▸
          </span>
        </button>
        {open ? (
          inWindow.length === 0 ? (
            <p className="border-t border-black/5 px-6 py-4 text-sm text-black/45 dark:border-white/5 dark:text-white/50 sm:px-7">
              Bu dövrdə qeydə alınmış hərəkət yoxdur.
            </p>
          ) : (
            <div className="border-t border-black/5 pb-3 dark:border-white/5">
              {groups.map((g) => (
                <div key={g.date}>
                  <p className="sticky top-0 bg-white/95 px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 backdrop-blur dark:bg-[#161c2b] dark:text-white/50 sm:px-6">
                    {g.date === todayIso ? `bu gün · ${longDate(g.date)}` : longDate(g.date)}
                  </p>
                  <div className="divide-y divide-black/5 dark:divide-white/5">
                    {g.rows.map((e) => (
                      <LedgerRow key={e.id} e={e} />
                    ))}
                  </div>
                </div>
              ))}
              {inWindow.length > limit ? (
                <div className="flex justify-center pt-3">
                  <button
                    type="button"
                    onClick={() => setLimit((l) => l + PAGE)}
                    className="rounded-full border border-bank-blue/30 bg-bank-blue/5 px-4 py-1.5 text-[11px] font-medium text-bank-blue transition hover:bg-bank-blue/10 dark:text-blue-400"
                  >
                    Daha çox ↓ ({inWindow.length - limit} qalır)
                  </button>
                </div>
              ) : null}
            </div>
          )
        ) : null}
        {partial ? (
          <p className="border-t border-black/5 px-6 py-3 text-[11px] text-black/45 dark:border-white/5 dark:text-white/50 sm:px-7">
            İstiqraz, günlük faiz və mükafat qeydləri yalnız öz hesabınız
            üzrə göstərilir; cədvəl hərəkətləri (depozit, kredit, aktivlər)
            bütün bank üzrədir.
          </p>
        ) : null}
      </div>
    </section>
  );
}
