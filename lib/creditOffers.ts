import { createSupabaseServerClient } from "@/lib/supabase/server";

// Personal credit offers — server data layer. İsmayıl sets one rule per
// account (fixed AZN, or a percent of remaining liquidity); the banner on
// /bank resolves the rule into an AZN figure at render time. RLS returns the
// caller's own row (İsmayıl sees all), so both readers run under the session
// client.

export type CreditOfferMode = "azn" | "pct";

export type CreditOffer = {
  holderName: string;
  mode: CreditOfferMode;
  value: number;
  updatedAt: string | null;
};

/** Same folding public.norm() applies on the database side. */
const norm = (s: string) =>
  s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");

function parseRow(row: Record<string, unknown>): CreditOffer | null {
  const holderName = String(row.holder_name ?? "").trim();
  const mode = row.mode === "pct" ? "pct" : row.mode === "azn" ? "azn" : null;
  const value = Number(row.value);
  if (!holderName || mode == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return {
    holderName,
    mode,
    value,
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  };
}

/**
 * The signed-in user's offer, or null. The name filter matters for İsmayıl
 * himself: RLS hands the admin every row, but his own banner must only ever
 * show his own offer.
 */
export async function getMyCreditOffer(
  name: string | null | undefined,
): Promise<CreditOffer | null> {
  if (!name) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("credit_offers")
    .select("holder_name, mode, value, updated_at");
  if (error) {
    console.error("[credit-offers] read failed:", error.message);
    return null;
  }
  const target = norm(name);
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const offer = parseRow(row);
    if (offer && norm(offer.holderName) === target) return offer;
  }
  return null;
}

/** Every offer — İsmayıl's cabinet list (RLS: admin sees all). */
export async function getAllCreditOffers(): Promise<CreditOffer[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("credit_offers")
    .select("holder_name, mode, value, updated_at")
    .order("holder_name");
  if (error) {
    console.error("[credit-offers] read failed:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[])
    .map(parseRow)
    .filter((o): o is CreditOffer => o != null);
}

/**
 * Resolve an offer rule into the advertised AZN figure. Percent offers track
 * the bank's remaining liquidity and floor to a whole manat — a marketing
 * number, unlike the precise figures the rest of the bank shows; the qəpik
 * would only wobble with every loan repayment.
 */
export function offerAmountAzn(
  offer: CreditOffer,
  netLiquidityAzn: number,
): number {
  if (offer.mode === "azn") return Math.floor(offer.value);
  return Math.max(0, Math.floor((netLiquidityAzn * offer.value) / 100));
}
