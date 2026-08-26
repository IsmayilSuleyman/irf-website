"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAzn, formatGrouped } from "@/lib/portfolio";
import { usePrivacy } from "@/components/PrivacyProvider";
import { IsmayilBankMark } from "@/components/IsmayilBankLogo";

type Point = {
  label: string;
  value: number;
  invested?: number;
  date?: string;
  /** The ETF book's slice of `value` at this date (tooltip decomposition). */
  other?: number;
  /** The ETF book's slice of `invested` at this date, so the tooltip can
   *  split Maya dəyəri the same way it splits Dəyər. */
  otherInvested?: number;
  /** A provisional "right now" point (the live session price the headline
   *  shows) — plotted as a dashed tail with a pulsing dot, excluded from
   *  the Zirvə search so a session print can't mint an all-time high. */
  live?: boolean;
};

/** A holder's own İRF transaction, for the ▲/▼ markers on the value line. */
export type ChartEvent = {
  date: string;
  units: number;
  /** A sale's realized P&L (sale price vs the running average cost at that
   *  moment), computed server-side; null/absent on buys. */
  realizedAzn?: number | null;
};

// Hydration-safe Azerbaijani date labels (no Intl in a client component).
const AZ_MONTHS_SHORT = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avq", "sen", "okt", "noy", "dek",
];
const AZ_MONTHS_LONG = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

function tickDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${AZ_MONTHS_SHORT[d.getUTCMonth()]} ${String(d.getUTCFullYear() % 100).padStart(2, "0")}`;
}

function tooltipDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${AZ_MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// `fine` names the minute-snapshot tier the range prefers when the caller
// passes one: 1G/1H exist ONLY with minute data (their pills hide without
// it), while 1 AY upgrades to 30-minute texture when available and falls
// back to the daily series otherwise.
const RANGES = [
  { key: "1g", label: "1G", days: 1, fine: "day" },
  { key: "1h", label: "1H", days: 7, fine: "week" },
  { key: "1m", label: "1 AY", days: 30, fine: "month" },
  { key: "3m", label: "3 AY", days: 90, fine: null },
  { key: "6m", label: "6 AY", days: 180, fine: null },
  { key: "1y", label: "1 İL", days: 365, fine: null },
  { key: "all", label: "BÜTÜN", days: null, fine: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/** The three minute-snapshot windows, as chart point arrays. */
export type FineTiers = {
  day: Point[];
  week: Point[];
  month: Point[];
};

// Baku wall-clock (fixed UTC+4, manual math — no Intl in a client
// component) for the fine ranges' tick and tooltip times.
function bakuTime(ms: number): string {
  const d = new Date(ms + 4 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const MODES = [
  { key: "value", label: "SAHİBLİK DƏYƏRİ" },
  { key: "price", label: "PAY QİYMƏTİ" },
] as const;

type ModeKey = (typeof MODES)[number]["key"];

// Polarity colors: profit band/green line, loss band, neutral cost basis.
// Green↔red is a weak pair under deutan CVD, so polarity is never color-alone
// here — the bands sit on opposite SIDES of the dashed cost line, buy/sell
// markers differ in SHAPE (▲/▼) and every tooltip value carries its sign.
const GREEN = "#16a34a";
const RED = "#dc2626";
const NEUTRAL = "#94a3b8";

type TimedPoint = Point & {
  ts: number;
  gainBand: [number, number] | null;
  lossBand: [number, number] | null;
  /** The solid line's series: every recorded point, null at the live tail. */
  valueSolid: number | null;
  /** The dashed tail's series: the last recorded point + the live point. */
  valueLive: number | null;
};

// The dashed tail wears the session's identity color (EXTENDED_META tints);
// during regular hours it stays the line's own green.
const LIVE_STROKE: Record<string, string> = {
  pre: "#f59e0b",
  post: "#a855f7",
  overnight: "#3b82f6",
};

function LiveDot({
  cx,
  cy,
  color,
}: {
  cx?: number;
  cy?: number;
  color?: string;
}) {
  if (cx == null || cy == null) return null;
  const c = color ?? GREEN;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={c} stroke="#fff" strokeWidth={1.5}>
        <animate
          attributeName="opacity"
          values="1;0.55;1"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={cx} cy={cy} r={4} fill="none" stroke={c} strokeWidth={1.5}>
        <animate
          attributeName="r"
          values="4;9"
          dur="1.6s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.6;0"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
}

type Marker = {
  ts: number;
  value: number;
  buyUnits: number;
  sellUnits: number;
  /** Summed realized P&L of the sales snapped to this point; null when no
   *  sale here carried one. */
  realizedAzn: number | null;
};

function TriangleDot({
  cx,
  cy,
  dir,
}: {
  cx?: number;
  cy?: number;
  dir: 1 | -1;
}) {
  if (cx == null || cy == null) return null;
  const h = 4.5 * dir;
  return (
    <path
      d={`M ${cx} ${cy - h} L ${cx + 4.5} ${cy + h} L ${cx - 4.5} ${cy + h} Z`}
      fill={dir === 1 ? GREEN : RED}
      stroke="#fff"
      strokeWidth={1.4}
    />
  );
}

function AthDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="none" stroke={GREEN} strokeWidth={1.6} opacity={0.85} />
      <circle cx={cx} cy={cy} r={2.4} fill={GREEN} stroke="#fff" strokeWidth={1.2} />
    </g>
  );
}

export function PerformanceChart({
  data,
  priceData,
  fineData,
  finePrice,
  events,
  sessionMode = null,
  hero,
  priceHero,
}: {
  data: Point[];
  priceData?: Point[];
  /** Minute-snapshot tiers for the fine ranges (1G/1H, richer 1 AY) in
   *  value mode; the pills hide when a tier is absent. */
  fineData?: FineTiers;
  /** Same, for price mode (the pay price's minute series). */
  finePrice?: FineTiers;
  /** The holder's own buys/sells — rendered as ▲/▼ markers in value mode so
   *  contribution jumps never masquerade as market moves. */
  events?: ChartEvent[];
  /** The extended session behind the live tail point, if any — colors the
   *  dashed segment and its pulsing dot. */
  sessionMode?: "pre" | "post" | "overnight" | null;
  /**
   * Optional summary block (headline figure + change lines) rendered inside
   * the card between the header and the plot — the Yahoo-app "portfolio
   * performance" composition. `hero` shows in value mode, `priceHero` in
   * price mode, so the headline always matches the plotted series.
   */
  hero?: ReactNode;
  priceHero?: ReactNode;
}) {
  const { hidden } = usePrivacy();
  const hasValue = data != null && data.length > 0;
  const hasPrice = priceData != null && priceData.length > 0;
  // New holders with no transactions still get the public price series.
  const [mode, setMode] = useState<ModeKey>(hasValue ? "value" : "price");
  const [range, setRange] = useState<RangeKey>("all");

  const source = mode === "price" ? (priceData ?? []) : data;
  const fineTiers = mode === "price" ? finePrice : fineData;
  // Ranges whose pill actually renders: 1G/1H only exist with their
  // minute tier; 1 AY always shows (it falls back to the daily series).
  const visibleRanges = RANGES.filter(
    (r) =>
      r.fine == null ||
      r.key === "1m" ||
      (fineTiers?.[r.fine]?.length ?? 0) >= 2,
  );
  // A mode switch can hide the selected fine pill (e.g. 1G chosen in price
  // mode, then value mode has no minute data) — fall back to BÜTÜN rather
  // than plotting a range the pills no longer offer.
  const activeRange = visibleRanges.some((r) => r.key === range)
    ? range
    : "all";

  const filtered = useMemo(() => {
    const rangeDef = RANGES.find((r) => r.key === activeRange);
    // A fine range prefers its minute tier; too-thin tiers fall back to
    // the daily series (which the cutoff below may then empty — the
    // chart's normal no-data state).
    const fine =
      rangeDef?.fine != null ? fineTiers?.[rangeDef.fine] : undefined;
    const effSource = fine && fine.length >= 2 ? fine : source;
    if (!effSource || effSource.length === 0) return [];
    const days = rangeDef?.days ?? null;
    const cutoff = days == null ? null : Date.now() - days * 24 * 60 * 60 * 1000;
    const inWindow =
      cutoff == null
        ? effSource
        : effSource.filter((p) => {
            if (!p.date) return true;
            const t = new Date(p.date).getTime();
            return Number.isFinite(t) && t >= cutoff;
          });
    if (mode !== "value") return inWindow;
    // A window can open inside a zero-value stretch (İRF sold, ETFs not yet
    // bought). Those leading zeros carry no story and would pin the line's
    // start to the axis — begin at the first owned day instead. A window
    // that is ALL zeros empties out, reading as "no data for this period".
    let start = 0;
    while (start < inWindow.length && inWindow[start].value <= 0) start += 1;
    return start > 0 ? inWindow.slice(start) : inWindow;
  }, [source, fineTiers, activeRange, mode]);

  const showInvested =
    mode === "value" && filtered.some((p) => p.invested != null);
  // One TOTAL line on the plot (İsmayıl's call) — the ETF book shows only
  // as the tooltip's İRF / Digər aktivlər decomposition, gated here.
  const showOther =
    mode === "value" && filtered.some((p) => (p.other ?? 0) > 0);

  // Numeric (epoch-ms) x-axis: points sit at their true time distance, so
  // sparse early history doesn't get compressed into equal category slots.
  // In value mode each point also carries its profit/loss band — the strip
  // between the value and the cost basis, split by sign — with an
  // interpolated point inserted at every crossing so the two fills meet at
  // the line instead of leaving a notch.
  const timed = useMemo<TimedPoint[]>(() => {
    const base = filtered
      .map((p) => ({ ...p, ts: p.date ? new Date(p.date).getTime() : NaN }))
      .filter((p) => Number.isFinite(p.ts))
      .sort((a, b) => a.ts - b.ts);

    // The NAV cron labels its row with the NEXT Baku day, whose date-only
    // string parses to a ts a couple of hours in the FUTURE around the
    // 21:30-00:00 UTC window — the live İndi point must still sort last,
    // or the dashed tail lands mid-chart and the solid line breaks.
    const liveIdx0 = base.findIndex((p) => p.live);
    if (liveIdx0 >= 0) {
      let maxOther = -Infinity;
      for (const p of base) if (!p.live && p.ts > maxOther) maxOther = p.ts;
      if (Number.isFinite(maxOther) && base[liveIdx0].ts <= maxOther) {
        base[liveIdx0] = { ...base[liveIdx0], ts: maxOther + 60_000 };
        base.sort((a, b) => a.ts - b.ts);
      }
    }

    const withCrossings: (Point & { ts: number })[] = [];
    for (let i = 0; i < base.length; i++) {
      const a = base[i];
      withCrossings.push(a);
      const b = base[i + 1];
      // No crossings into the live tail — a synthetic point there would
      // render as SOLID line + band and could even mint the Zirvə ring
      // from a provisional session print.
      if (
        !showInvested ||
        !b ||
        a.live ||
        b.live ||
        a.invested == null ||
        b.invested == null
      )
        continue;
      const da = a.value - a.invested;
      const db = b.value - b.invested;
      if (da * db < 0) {
        const t = da / (da - db);
        const ts = a.ts + t * (b.ts - a.ts);
        const v = a.value + t * (b.value - a.value);
        withCrossings.push({ label: "", date: undefined, ts, value: v, invested: v });
      }
    }

    const liveIdx = withCrossings.findIndex((p) => (p as Point).live);
    return withCrossings.map((p, i) => {
      // The live tail carries no P&L band — the recorded basis story ends
      // at the last recorded point.
      const inv =
        showInvested && !(p as Point).live ? (p.invested ?? null) : null;
      // Bands as [low, high] range areas, continuous (zero-height on the
      // inactive side) so the fills never break; the crossing points
      // inserted above pinch each band to nothing exactly at the line.
      return {
        ...p,
        gainBand: inv != null ? [inv, Math.max(inv, p.value)] : null,
        lossBand: inv != null ? [Math.min(inv, p.value), inv] : null,
        valueSolid: (p as Point).live ? null : p.value,
        valueLive:
          liveIdx >= 0 && (i === liveIdx || i === liveIdx - 1)
            ? p.value
            : null,
      } as TimedPoint;
    });
  }, [filtered, showInvested]);

  const last = timed.length > 0 ? timed[timed.length - 1] : null;

  // Fine windows label by wall clock: under ~2 days the axis ticks are
  // Baku times; under ~8 days the tooltip carries date + time.
  const spanMs = timed.length > 1 ? timed[timed.length - 1].ts - timed[0].ts : 0;
  const timeTicks = spanMs > 0 && spanMs <= 50 * 3_600_000;
  const timeTooltip = spanMs > 0 && spanMs <= 8 * 86_400_000;

  // Whole-manat ticks collapse into "5 · 5 · 5" on a small book (a 5 ₼ ETF
  // position moving by qəpiks) — grow decimals as the visible span shrinks
  // so neighboring ticks stay distinct.
  const yTickDecimals = useMemo(() => {
    if (timed.length === 0) return 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of timed) {
      if (p.value < lo) lo = p.value;
      if (p.value > hi) hi = p.value;
    }
    const span = hi - lo;
    return span <= 0.4 ? 2 : span <= 4 ? 1 : 0;
  }, [timed]);

  // The window's peak — ringed on the plot ("Zirvə" in the key). When the
  // peak IS the newest point, the ring replaces the plain last-point dot.
  // The live tail never competes: a provisional session print must not
  // mint an all-time high.
  const ath = useMemo(() => {
    let best: TimedPoint | null = null;
    for (const p of timed) {
      if (p.live) continue;
      if (best == null || p.value > best.value) best = p;
    }
    return best;
  }, [timed]);

  // ▲/▼ markers: each of the holder's transactions snaps to the nearest
  // plotted point; several on one point aggregate. Value mode only.
  const markers = useMemo<Marker[]>(() => {
    if (mode !== "value" || !events || events.length === 0 || timed.length === 0)
      return [];
    // Markers never snap to the provisional İndi point — a same-day trade
    // pins to the last recorded row, as before the live tail existed.
    const plotted = timed.filter((p) => p.date != null && !p.live);
    if (plotted.length === 0) return [];
    const windowStart = plotted[0].ts;
    const windowEnd = plotted[plotted.length - 1].ts;
    const byTs = new Map<number, Marker>();
    for (const e of events) {
      const ms = new Date(e.date).getTime();
      if (!Number.isFinite(ms) || e.units === 0) continue;
      // Only events inside the plotted window: a transaction from before it
      // (an İRF exit months back, viewed on 1 AY) must not pin a marker to
      // the window's first point. Half a day of slack absorbs recording-time
      // vs midnight offsets.
      if (ms < windowStart - 43_200_000 || ms > windowEnd + 86_400_000)
        continue;
      let nearest = plotted[0];
      for (const p of plotted) {
        if (Math.abs(p.ts - ms) < Math.abs(nearest.ts - ms)) nearest = p;
      }
      if (Math.abs(nearest.ts - ms) > 40 * 86_400_000) continue;
      const m = byTs.get(nearest.ts) ?? {
        ts: nearest.ts,
        value: nearest.value,
        buyUnits: 0,
        sellUnits: 0,
        realizedAzn: null,
      };
      if (e.units > 0) {
        m.buyUnits += e.units;
      } else {
        m.sellUnits += -e.units;
        if (e.realizedAzn != null)
          m.realizedAzn = (m.realizedAzn ?? 0) + e.realizedAzn;
      }
      byTs.set(nearest.ts, m);
    }
    return [...byTs.values()];
  }, [mode, events, timed]);

  const markerByTs = useMemo(
    () => new Map(markers.map((m) => [m.ts, m])),
    [markers],
  );

  // The pill across the visible window. PRICE mode: plain first-to-last %
  // change — a price series has no cash flows. VALUE mode: money moved in
  // or out (a sale, a fresh buy) must not read as performance — a holder
  // who exits İRF and keeps a 5 ₼ ETF book hasn't "lost 99%". The pill
  // tracks PROFIT/LOSS instead: the change in unrealized P&L (value minus
  // the holdings' maya dəyəri) plus the realized P&L of sales dated inside
  // the window, measured against the largest capital at work in the
  // window. Null when there is nothing to compare against.
  const periodChange = useMemo(() => {
    if (timed.length < 2) return null;
    const first = timed[0];
    const last = timed[timed.length - 1];
    if (mode !== "value" || first.invested == null || last.invested == null) {
      const open = first.value;
      if (!Number.isFinite(open) || open <= 0) return null;
      return last.value / open - 1;
    }
    let realized = 0;
    for (const e of events ?? []) {
      if (e.realizedAzn == null) continue;
      const ms = new Date(e.date).getTime();
      if (
        Number.isFinite(ms) &&
        ms >= first.ts - 43_200_000 &&
        ms <= last.ts + 86_400_000
      ) {
        realized += e.realizedAzn;
      }
    }
    const pnlDelta =
      last.value - last.invested - (first.value - first.invested) + realized;
    let base = 0;
    for (const p of timed) {
      if (p.invested != null && p.invested > base) base = p.invested;
    }
    if (base <= 0) return null;
    return pnlDelta / base;
  }, [timed, mode, events]);

  if (!hasValue && !hasPrice) {
    return (
      <div className="glass flex h-72 items-center justify-center text-black/45 dark:text-white/50">
        Tarixçə yoxdur.
      </div>
    );
  }

  // Your holding value is personal — masked in hide-amounts mode. The unit
  // price is the same for every holder (public), so it never gets masked.
  const masked = hidden && mode === "value";
  const fmt = (v: number) => (masked ? "••••" : formatAzn(v));

  /**
   * The period-change readout, rendered in two places with one definition so
   * the wordings can never diverge: in the control row on sm+, overlaid on
   * the plot's top-right corner on phones. It is a readout, not a control —
   * no hover state, no aria-pressed. Percentages stay visible in hide-amounts
   * mode, matching the rest of the app: a return reveals no position size.
   */
  const changePill = (className: string) =>
    periodChange == null ? null : (
      <span
        title={
          mode === "value"
            ? "Seçilmiş dövr üzrə mənfəət/zərər (reallaşmış + reallaşmamış)"
            : "Seçilmiş dövr üzrə dəyişim"
        }
        className={`num rounded-lg border px-2 py-1.5 text-center text-[10px] font-semibold tracking-[0.06em] sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.08em] ${
          periodChange >= 0
            ? "border-brand-green/30 bg-brand-green/10 text-brand-green dark:text-emerald-400"
            : "border-brand-red/30 bg-brand-red/10 text-brand-red dark:text-red-400"
        } ${className}`}
      >
        {periodChange >= 0 ? "+" : ""}
        {(periodChange * 100).toFixed(1)}%
      </span>
    );

  // One tooltip for everything under the cursor: the series values, the net
  // profit against the cost basis, and the day's own buys/sells.
  function ChartTip({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: TimedPoint }>;
  }) {
    const p = active && payload && payload.length > 0 ? payload[0].payload : null;
    if (!p || p.date == null) return null;
    const inv = showInvested ? (p.invested ?? null) : null;
    const pnl = inv != null ? p.value - inv : null;
    const pnlPct = inv != null && inv > 0 ? (p.value / inv - 1) * 100 : null;
    const marker = markerByTs.get(p.ts);
    return (
      <div
        className="rounded-xl px-3.5 py-3 text-[12px]"
        // Inline (not utility classes): the recharts portal renders outside
        // the themed tree, and the panel stays light in both modes like the
        // previous tooltip did.
        style={{
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 8px 30px -12px rgba(0,0,0,0.3)",
        }}
      >
        <p className="text-[11px] text-black/50 dark:text-white/50">
          {p.live
            ? "İndi — seans qiyməti"
            : timeTooltip
              ? `${tooltipDate(p.ts)}, ${bakuTime(p.ts)}`
              : tooltipDate(p.ts)}
        </p>
        <div className="mt-1.5 space-y-1">
          <p className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-black/60 dark:text-white/65">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: GREEN }} />
              {mode === "price" ? "1 payın qiyməti" : "Dəyər"}
            </span>
            <span className="num font-semibold text-black dark:text-white/90">{fmt(p.value)}</span>
          </p>
          {showOther && p.other != null && p.other > 0 ? (
            <p className="flex items-center justify-between gap-6 pl-3.5 text-[11px]">
              <span className="text-black/50 dark:text-white/55">İRF</span>
              <span className="num text-black/70 dark:text-white/75">
                {fmt(p.value - p.other)}
              </span>
            </p>
          ) : null}
          {showOther && p.other != null && p.other > 0 ? (
            <p className="flex items-center justify-between gap-6 pl-3.5 text-[11px]">
              <span className="flex items-center gap-1.5 text-black/50 dark:text-white/55">
                {/* The ETF book is bought through İsmayılBank — its cross
                    mark replaces a line swatch here, since the plot draws
                    one total line and has no separate Digər aktivlər line. */}
                <IsmayilBankMark size={12} />
                Digər aktivlər
              </span>
              <span className="num text-black/70 dark:text-white/75">{fmt(p.other)}</span>
            </p>
          ) : null}
          {inv != null ? (
            <p className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-black/60 dark:text-white/65">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: NEUTRAL }} />
                Maya dəyəri
              </span>
              <span className="num font-semibold text-black dark:text-white/90">{fmt(inv)}</span>
            </p>
          ) : null}
          {/* Cost basis splits the same way the value does, so the İRF and
              ETF slices can each be read against their own maya dəyəri. */}
          {inv != null && showOther && p.other != null && p.other > 0 && p.otherInvested != null ? (
            <>
              <p className="flex items-center justify-between gap-6 pl-3.5 text-[11px]">
                <span className="text-black/50 dark:text-white/55">İRF</span>
                <span className="num text-black/70 dark:text-white/75">
                  {fmt(Math.max(0, inv - p.otherInvested))}
                </span>
              </p>
              <p className="flex items-center justify-between gap-6 pl-3.5 text-[11px]">
                <span className="text-black/50 dark:text-white/55">
                  Digər aktivlər
                </span>
                <span className="num text-black/70 dark:text-white/75">
                  {fmt(p.otherInvested)}
                </span>
              </p>
            </>
          ) : null}
          {pnl != null ? (
            <p className="flex items-center justify-between gap-6 border-t border-black/10 dark:border-white/15 pt-1">
              <span className="text-black/60 dark:text-white/65">Mənfəət</span>
              <span
                className="num font-semibold"
                style={{ color: pnl >= 0 ? GREEN : RED }}
              >
                {pnl >= 0 ? "+" : "−"}
                {fmt(Math.abs(pnl))}
                {pnlPct != null ? (
                  <span className="ml-1 text-[10px] opacity-80">
                    ({pnl >= 0 ? "+" : "−"}
                    {formatGrouped(Math.abs(pnlPct), 1)}%)
                  </span>
                ) : null}
              </span>
            </p>
          ) : null}
          {marker ? (
            <p className="border-t border-black/10 dark:border-white/15 pt-1 text-[11px]">
              {marker.buyUnits > 0 ? (
                <span style={{ color: GREEN }}>
                  ▲ Alış{masked ? "" : `: +${formatGrouped(marker.buyUnits, 0)} pay`}
                </span>
              ) : null}
              {marker.buyUnits > 0 && marker.sellUnits > 0 ? " · " : null}
              {marker.sellUnits > 0 ? (
                <span style={{ color: RED }}>
                  ▼ Satış{masked ? "" : `: −${formatGrouped(marker.sellUnits, 0)} pay`}
                </span>
              ) : null}
              {marker.realizedAzn != null ? (
                <span
                  className="mt-0.5 block"
                  style={{ color: marker.realizedAzn >= 0 ? GREEN : RED }}
                >
                  Satışdan {marker.realizedAzn >= 0 ? "mənfəət" : "zərər"}:{" "}
                  <span className="num font-semibold">
                    {marker.realizedAzn >= 0 ? "+" : "−"}
                    {fmt(Math.abs(marker.realizedAzn))}
                  </span>
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="glass w-full p-6">
      {/* Header: one short label left ("Tarixçə" — the mode buttons beside
          it already name the series), mode switch right; the range buttons
          moved below the plot (Yahoo-app composition, see bottom). */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="whitespace-nowrap text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
          Tarixçə
        </span>
        <div className="ml-auto flex items-center gap-2">
          {changePill("hidden sm:inline-block")}
          {hasValue && hasPrice && (
            <div className="flex items-center gap-1">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  aria-pressed={mode === m.key}
                  className={`whitespace-nowrap rounded-lg border px-1 py-1.5 text-center text-[10px] font-medium tracking-[0.02em] transition sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.08em] ${
                    mode === m.key
                      ? "border-brand-green bg-brand-green text-white shadow-sm"
                      : "border-brand-green/30 bg-white/60 dark:bg-white/5 text-black/55 dark:text-white/60 hover:border-brand-green hover:text-brand-green dark:hover:text-emerald-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {mode === "price" ? priceHero : hero}
      <div className="relative h-72">
        {/* Phones: the pill rides top-LEFT — the mirrored value labels own
            the right edge now. */}
        {timed.length > 0 && (
          <div className="pointer-events-none absolute left-1 top-0 z-10 sm:hidden">
            {changePill("")}
          </div>
        )}
        {timed.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-black/45 dark:text-white/50">
            Bu dövr üçün məlumat yoxdur.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={timed}
              margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="pcGain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="pcPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                stroke="rgba(0,0,0,0.45)"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tickFormatter={timeTicks ? bakuTime : tickDate}
              />
              {/* Value labels float inside the RIGHT edge (mirror) so the
                  plot's left edge sits flush with the card's text — the
                  finance-app composition İsmayıl asked for. */}
              <YAxis
                hide={masked}
                orientation="right"
                mirror
                domain={["auto", "auto"]}
                width={1}
                tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }}
                tickLine={false}
                axisLine={false}
                tickCount={4}
                tickFormatter={(v: number) => formatGrouped(v, yTickDecimals)}
              />
              <Tooltip content={<ChartTip />} />
              {/* Price mode keeps the classic under-line gradient; value mode
                  trades it for the profit/loss bands against the cost basis —
                  the strip between the lines IS the P&L. Children are an
                  ARRAY, never a fragment: recharts matches its direct
                  children by type and silently drops anything inside <>. */}
              {(mode === "price" || !showInvested) && (
                // valueSolid, not value: the gradient ends at the last
                // recorded point, matching the dashed live tail's
                // provisional treatment.
                <Area
                  type="monotone"
                  dataKey="valueSolid"
                  stroke="none"
                  fill="url(#pcPrice)"
                />
              )}
              {mode === "value" &&
                showInvested && [
                  <Area
                    key="gainBand"
                    type="monotone"
                    dataKey="gainBand"
                    stroke="none"
                    fill="url(#pcGain)"
                    isAnimationActive={false}
                    tooltipType="none"
                  />,
                  <Area
                    key="lossBand"
                    type="monotone"
                    dataKey="lossBand"
                    stroke="none"
                    fill={RED}
                    fillOpacity={0.16}
                    isAnimationActive={false}
                    tooltipType="none"
                  />,
                ]}
              <Line
                type="monotone"
                dataKey="valueSolid"
                stroke={GREEN}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, stroke: "#fff", strokeWidth: 1.5 }}
              />
              {/* Dashed live tail: last recorded close → the session price
                  the headline shows, in the session's identity color. */}
              <Line
                type="linear"
                dataKey="valueLive"
                stroke={sessionMode ? LIVE_STROKE[sessionMode] : GREEN}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 4, stroke: "#fff", strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
              {showInvested && (
                <Line
                  type="stepAfter"
                  dataKey="invested"
                  stroke={NEUTRAL}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={false}
                />
              )}
              {markers.map((mk) => (
                <ReferenceDot
                  key={`mk-${mk.ts}`}
                  x={mk.ts}
                  y={mk.value}
                  shape={
                    <TriangleDot dir={mk.buyUnits >= mk.sellUnits ? 1 : -1} />
                  }
                />
              ))}
              {ath && (
                <ReferenceDot x={ath.ts} y={ath.value} shape={<AthDot />} />
              )}
              {last && last.live && (
                <ReferenceDot
                  x={last.ts}
                  y={last.value}
                  shape={
                    <LiveDot
                      color={sessionMode ? LIVE_STROKE[sessionMode] : GREEN}
                    />
                  }
                />
              )}
              {last && !last.live && (!ath || ath.ts !== last.ts) && (
                <ReferenceDot
                  x={last.ts}
                  y={last.value}
                  r={4}
                  fill={GREEN}
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* Glyph key — identity is never color-alone: the marker shapes and
          line styles repeat here in words. Value mode only; price mode is a
          single self-named series. */}
      {mode === "value" && showInvested && timed.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-black/40 dark:text-white/45">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: GREEN }} />
            Dəyər
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0 w-4 border-t border-dashed"
              style={{ borderColor: NEUTRAL }}
            />
            Maya dəyəri
          </span>
          {markers.length > 0 ? (
            <>
              <span style={{ color: GREEN }}>▲ Alış</span>
              <span style={{ color: RED }}>▼ Satış</span>
            </>
          ) : null}
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border"
              style={{ borderColor: GREEN }}
            />
            Zirvə
          </span>
        </div>
      ) : null}
      {/* Range buttons below the plot. Compact FIXED-width pills in a
          scrollable flex row on phones — the old equal-column grid divided
          the screen by 7 and visibly crushed the labels; shrink-0 +
          nowrap means a pill can never render narrower than its text, and
          a too-narrow screen scrolls the row instead. */}
      <div className="mt-4 flex items-center gap-1.5 sm:gap-2">
        <div className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto sm:flex-none sm:gap-2">
          {visibleRanges.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={activeRange === r.key}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-2 py-1 text-center text-[10px] font-medium tracking-[0.05em] transition sm:px-3 sm:text-[11px] sm:tracking-[0.08em] ${
                activeRange === r.key
                  ? "border-brand-green bg-brand-green text-white shadow-sm"
                  : "border-brand-green/30 bg-white/60 dark:bg-white/5 text-black/55 dark:text-white/60 hover:border-brand-green hover:text-brand-green dark:hover:text-emerald-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="hidden text-[10px] text-black/45 dark:text-white/50 sm:inline">
          ₼
        </span>
      </div>
    </div>
  );
}
