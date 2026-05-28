import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FUND_PRINCIPAL_NAME } from "@/lib/holdings";
import { getFundData } from "@/lib/sheets";

const norm = (s: string) =>
  s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");

export type MarketStatus = {
  unit_price: number;
  commission: number;
  satis: number;
  alis: number;
  best_buy_order: number | null;
  best_sell_order: number | null;
  total_units: number;
  float_cap_pct: number;
  public_float_pct: number;
  fund_sell_capacity: number;
  is_admin: boolean;
  updated_at: string | null;
};

export type BookLevel = {
  side: "buy" | "sell";
  price: number;
  units: number;
  holderName: string;
};

export type OrderRow = {
  id: string;
  user_id: string;
  side: "buy" | "sell";
  units: number;
  remaining_units: number;
  price: number;
  status: "open" | "partial" | "filled" | "cancelled";
  created_at: string;
};

export type TradeRow = {
  id: string;
  buyer_user_id: string | null;
  seller_user_id: string | null;
  buyer_name: string;
  seller_name: string;
  units: number;
  price: number;
  counterparty_kind: "p2p" | "fund_buy" | "fund_sell";
  status: "pending" | "settled" | "cancelled";
  created_at: string;
  settled_at: string | null;
};

export type MarketData = {
  user: User;
  holderName: string | null;
  status: MarketStatus;
  book: BookLevel[];
  myOrders: OrderRow[];
  myTrades: TradeRow[];
  availableToSell: number;
  isAdmin: boolean;
  adminPending: TradeRow[];
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

/**
 * Push the live Sheet unit price into fund_config so the bazar tracks the same
 * price the dashboard shows. Best-effort: a missing secret or a failed Sheet
 * read leaves the last-synced price in place rather than breaking the page.
 * The value comes from the trusted server; the RPC is secret-gated server-side.
 */
async function refreshUnitPriceFromSheet(supabase: SupabaseClient): Promise<void> {
  const secret = process.env.MARKET_REFRESH_SECRET;
  if (!secret) return;
  try {
    const fund = await getFundData();
    if (fund.unitPrice > 0) {
      await supabase.rpc("refresh_fund_price", {
        p_unit_price: fund.unitPrice,
        p_secret: secret,
      });
    }
  } catch (err) {
    console.error("refresh_fund_price failed:", err);
  }
}

export type MarketQuotes = {
  bestBuyOrder: number | null;
  bestSellOrder: number | null;
  fundCanSell: boolean;
};

/**
 * Lightweight order-book quotes for pages that don't need the full market
 * payload (e.g. the dashboard badge). Returns the resting best bid/ask and
 * whether the Fund is currently selling, so the caller can combine them with a
 * live unit price via bestQuotes(). null when Supabase isn't configured.
 */
export async function getMarketQuotes(): Promise<MarketQuotes | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("market_status");
  if (error || !data) return null;
  const s = data as Record<string, unknown>;
  return {
    bestBuyOrder: s.best_buy_order == null ? null : num(s.best_buy_order),
    bestSellOrder: s.best_sell_order == null ? null : num(s.best_sell_order),
    fundCanSell: num(s.fund_sell_capacity) > 0,
  };
}

/**
 * Loads everything the /market page needs for the current user in one pass.
 * Reads run under the user's session, so RLS scopes orders/trades correctly
 * (a participant sees only their own; the admin sees all).
 */
export async function getMarketData(): Promise<MarketData | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const holderName = displayName(user.user_metadata);

  // Track the live Sheet price before reading status, so the bazar's unit
  // price (and the engine's floor/cap) match the dashboard.
  await refreshUnitPriceFromSheet(supabase);

  const [statusRes, bookRes, ordersRes, tradesRes, availRes] = await Promise.all([
    supabase.rpc("market_status"),
    supabase.rpc("order_book"),
    supabase
      .from("orders")
      .select("id, user_id, side, units, remaining_units, price, status, created_at")
      .eq("hidden", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("trades")
      .select(
        "id, buyer_user_id, seller_user_id, buyer_name, seller_name, units, price, counterparty_kind, status, created_at, settled_at",
      )
      .order("created_at", { ascending: false }),
    supabase.rpc("my_available_to_sell"),
  ]);

  const rawStatus = (statusRes.data ?? {}) as Record<string, unknown>;
  const status: MarketStatus = {
    unit_price: num(rawStatus.unit_price),
    commission: num(rawStatus.commission),
    satis: num(rawStatus.satis),
    alis: num(rawStatus.alis),
    best_buy_order: rawStatus.best_buy_order == null ? null : num(rawStatus.best_buy_order),
    best_sell_order: rawStatus.best_sell_order == null ? null : num(rawStatus.best_sell_order),
    total_units: num(rawStatus.total_units),
    float_cap_pct: num(rawStatus.float_cap_pct),
    public_float_pct: num(rawStatus.public_float_pct),
    fund_sell_capacity: num(rawStatus.fund_sell_capacity),
    is_admin: Boolean(rawStatus.is_admin),
    updated_at: (rawStatus.updated_at as string) ?? null,
  };

  const book: BookLevel[] = (bookRes.data ?? []).map((b: Record<string, unknown>) => ({
    side: b.side as "buy" | "sell",
    price: num(b.price),
    units: num(b.units),
    holderName: (b.holder_name as string) ?? "",
  }));

  const allOrders = (ordersRes.data ?? []) as OrderRow[];
  const allTrades = (tradesRes.data ?? []) as TradeRow[];
  const isAdmin = status.is_admin;
  const principal = norm(FUND_PRINCIPAL_NAME);

  const mineByName = (t: TradeRow) =>
    (!!holderName && (norm(t.buyer_name) === norm(holderName) || norm(t.seller_name) === norm(holderName))) ||
    // principal's fund-side trades carry no user_id
    (isAdmin && (norm(t.buyer_name) === principal || norm(t.seller_name) === principal));

  const myOrders = allOrders.filter((o) => o.user_id === user.id);
  const myTrades = allTrades.filter(
    (t) => t.buyer_user_id === user.id || t.seller_user_id === user.id || mineByName(t),
  );
  const adminPending = isAdmin ? allTrades.filter((t) => t.status === "pending") : [];

  return {
    user,
    holderName,
    status,
    book,
    myOrders,
    myTrades,
    availableToSell: num(availRes.data),
    isAdmin,
    adminPending,
  };
}
