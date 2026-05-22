import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHolderByName, type FundData, type Transaction } from "@/lib/sheets";

/**
 * The fund principal (İsmayıl). The Fund's guaranteed buyback and conditional
 * sell obligations are settled against this holder. Override via env if needed.
 */
export const FUND_PRINCIPAL_NAME =
  process.env.FUND_PRINCIPAL_NAME?.trim() || "İSMAYIL SÜLEYMAN";

// Mirrors the name normalization used in lib/sheets.ts so trade names (from the
// auth JWT) match holder names (from the Google Sheet).
const norm = (s: string) =>
  s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");

type SettledTradeRow = {
  buyer_name: string;
  seller_name: string;
  units: number | string;
  price: number | string;
  settled_at: string | null;
  created_at: string;
};

export type HolderMarketState = {
  openingUnits: number; // from the Google Sheet (Sahiblik) — the opening balance
  effectiveUnits: number; // opening + net settled market trades
  marketTransactions: Transaction[]; // settled trades shaped for P&L helpers
};

/**
 * Live holding state for a holder: the Google Sheet supplies the opening balance,
 * settled market trades (Supabase) are layered on top. Settled trades are also
 * returned as Transaction[] so the existing P&L helpers in lib/sheets.ts can
 * fold them into avg-buy-price / value-history calculations.
 */
export async function getHolderMarketState(
  name: string | null | undefined,
): Promise<HolderMarketState> {
  if (!name) {
    return { openingUnits: 0, effectiveUnits: 0, marketTransactions: [] };
  }

  const opening = (await getHolderByName(name))?.units ?? 0;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { openingUnits: opening, effectiveUnits: opening, marketTransactions: [] };
  }

  const { data, error } = await supabase
    .from("trades")
    .select("buyer_name, seller_name, units, price, settled_at, created_at")
    .eq("status", "settled");

  if (error) {
    console.error("Settled trades fetch error:", error);
    return { openingUnits: opening, effectiveUnits: opening, marketTransactions: [] };
  }

  const target = norm(name);
  let net = 0;
  const marketTransactions: Transaction[] = [];

  for (const row of (data ?? []) as SettledTradeRow[]) {
    const units = Number(row.units);
    const price = Number(row.price);
    const date = row.settled_at ?? row.created_at;
    if (!Number.isFinite(units) || units <= 0) continue;

    if (norm(row.buyer_name) === target) {
      net += units;
      marketTransactions.push({ holderName: name, date, units, price });
    } else if (norm(row.seller_name) === target) {
      net -= units;
      marketTransactions.push({ holderName: name, date, units: -units, price });
    }
  }

  return {
    openingUnits: opening,
    effectiveUnits: opening + net,
    marketTransactions,
  };
}

/**
 * Builds the payload for the sync_fund_state RPC from current Google Sheet data.
 * Seeds opening balances + trusted config (unit price, total units, principal).
 */
export function buildFundSyncPayload(
  fund: FundData,
  principalName: string = FUND_PRINCIPAL_NAME,
) {
  return {
    principal_name: principalName,
    total_units: fund.totalUnits,
    unit_price: fund.unitPrice,
    opening_balances: fund.holders.map((h) => ({
      holder_name: h.name,
      opening_units: h.units,
    })),
  };
}
