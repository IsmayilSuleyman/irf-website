import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FUND_PRINCIPAL_NAME } from "@/lib/holdings";

// İsmayılBank bonds (istiqraz): server data layer for /bonds, modeled on
// lib/market.ts. All reads run under the user's session so RLS scopes
// orders/trades/payments correctly (participants see their own; İsmayıl
// sees everything).

const norm = (s: string) =>
  s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");

export type BondSeries = {
  id: string;
  name: string;
  face_value_azn: number;
  coupon_rate_pct: number;
  coupon_period_months: number;
  issue_price_azn: number;
  total_units: number;
  issue_date: string;
  maturity_date: string;
  status: "active" | "matured" | "cancelled";
  primary_sold: number;
  primary_available: number;
  next_coupon_date: string | null;
  best_bid: number | null;
  best_ask: number | null;
  my_units: number;
  my_available: number;
};

export type BondBookLevel = {
  side: "buy" | "sell";
  price: number;
  units: number;
  holderName: string;
};

export type BondOrderRow = {
  id: string;
  series_id: string;
  user_id: string;
  side: "buy" | "sell";
  units: number;
  remaining_units: number;
  price: number;
  status: "open" | "partial" | "filled" | "cancelled";
  created_at: string;
};

export type BondTradeRow = {
  id: string;
  series_id: string;
  buyer_user_id: string | null;
  seller_user_id: string | null;
  buyer_name: string;
  seller_name: string;
  units: number;
  price: number;
  counterparty_kind: "p2p" | "primary";
  status: "pending" | "settled" | "cancelled";
  created_at: string;
  settled_at: string | null;
};

export type BondPaymentRow = {
  id: string;
  series_id: string;
  payment_kind: "coupon" | "principal";
  due_date: string;
  holder_name: string;
  units: number;
  amount_azn: number;
  paid_at: string;
};

export type BondMarketData = {
  user: User;
  holderName: string | null;
  isAdmin: boolean;
  series: BondSeries[];
  /** seriesId -> live order book (active series only). */
  books: Record<string, BondBookLevel[]>;
  myOrders: BondOrderRow[];
  myTrades: BondTradeRow[];
  /** Coupon/principal payments visible to the caller (own; admin sees all). */
  payments: BondPaymentRow[];
  adminPending: BondTradeRow[];
};

function displayName(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.display_name as string) ||
    null
  );
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v: unknown) => (v == null ? null : num(v));

function parseSeries(raw: unknown): BondSeries[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: Record<string, unknown>) => ({
    id: String(s.id ?? ""),
    name: String(s.name ?? ""),
    face_value_azn: num(s.face_value_azn),
    coupon_rate_pct: num(s.coupon_rate_pct),
    coupon_period_months: num(s.coupon_period_months),
    issue_price_azn: num(s.issue_price_azn),
    total_units: num(s.total_units),
    issue_date: (s.issue_date as string) ?? "",
    maturity_date: (s.maturity_date as string) ?? "",
    status: (s.status as BondSeries["status"]) ?? "active",
    primary_sold: num(s.primary_sold),
    primary_available: num(s.primary_available),
    next_coupon_date: (s.next_coupon_date as string) ?? null,
    best_bid: numOrNull(s.best_bid),
    best_ask: numOrNull(s.best_ask),
    my_units: num(s.my_units),
    my_available: num(s.my_available),
  }));
}

/** Loads everything the /bonds page needs for the current user in one pass. */
export async function getBondMarketData(): Promise<BondMarketData | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const holderName = displayName(user.user_metadata);

  const [statusRes, ordersRes, tradesRes, paymentsRes] = await Promise.all([
    supabase.rpc("bond_market_status"),
    supabase
      .from("bond_orders")
      .select("id, series_id, user_id, side, units, remaining_units, price, status, created_at")
      .eq("hidden", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("bond_trades")
      .select(
        "id, series_id, buyer_user_id, seller_user_id, buyer_name, seller_name, units, price, counterparty_kind, status, created_at, settled_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("bond_payments")
      .select("id, series_id, payment_kind, due_date, holder_name, units, amount_azn, paid_at")
      .order("paid_at", { ascending: false }),
  ]);

  // An RPC failure would otherwise render as a plausible "no bonds yet"
  // empty state — log loudly so drift is visible in the server logs.
  if (statusRes.error) {
    console.error("[bonds] bond_market_status failed:", statusRes.error);
  }
  if (ordersRes.error) console.error("[bonds] bond_orders select failed:", ordersRes.error);
  if (tradesRes.error) console.error("[bonds] bond_trades select failed:", tradesRes.error);
  if (paymentsRes.error) console.error("[bonds] bond_payments select failed:", paymentsRes.error);

  const rawStatus = (statusRes.data ?? {}) as Record<string, unknown>;
  const isAdmin = Boolean(rawStatus.is_admin);
  const series = parseSeries(rawStatus.series);

  // One book per active series (there are only ever a handful of series).
  const activeSeries = series.filter((s) => s.status === "active");
  const bookResults = await Promise.all(
    activeSeries.map((s) => supabase.rpc("bond_order_book", { p_series_id: s.id })),
  );
  const books: Record<string, BondBookLevel[]> = {};
  activeSeries.forEach((s, i) => {
    books[s.id] = ((bookResults[i].data ?? []) as Record<string, unknown>[]).map((b) => ({
      side: b.side as "buy" | "sell",
      price: num(b.price),
      units: num(b.units),
      holderName: (b.holder_name as string) ?? "",
    }));
  });

  const allOrders = (ordersRes.data ?? []) as BondOrderRow[];
  const allTrades = (tradesRes.data ?? []) as BondTradeRow[];
  const payments = (paymentsRes.data ?? []) as BondPaymentRow[];

  // Primary trades carry no seller user id (the bank side), so İsmayıl's own
  // rows are matched by normalized display name too — same as the share bazar.
  // The FUND_PRINCIPAL_NAME arm covers the admin whose JWT display name drifts
  // from the configured principal name (mirrors lib/market.ts).
  const principal = norm(FUND_PRINCIPAL_NAME);
  const mineByName = (t: BondTradeRow) =>
    (!!holderName &&
      (norm(t.buyer_name) === norm(holderName) || norm(t.seller_name) === norm(holderName))) ||
    (isAdmin && (norm(t.buyer_name) === principal || norm(t.seller_name) === principal));

  const myOrders = allOrders.filter((o) => o.user_id === user.id);
  const myTrades = allTrades.filter(
    (t) => t.buyer_user_id === user.id || t.seller_user_id === user.id || mineByName(t),
  );
  const adminPending = isAdmin ? allTrades.filter((t) => t.status === "pending") : [];

  return {
    user,
    holderName,
    isAdmin,
    series,
    books,
    myOrders,
    myTrades,
    payments,
    adminPending,
  };
}
