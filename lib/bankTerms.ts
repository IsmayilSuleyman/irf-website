import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { getSupabaseConfig } from "@/lib/supabase/config";

// Advertised İsmayılBank product terms (deposit/credit rate tiers), editable
// by İsmayıl via the admin panel (admin_set_bank_product_terms RPC). These
// feed the public calculators; per-account terms still come from the Sheet.

export type ProductTerm = { termMonths: number; annualRatePct: number };

export type BankProductTerms = {
  deposit: ProductTerm[];
  credit: ProductTerm[];
};

// Pre-DB hardcoded tiers, kept as a fallback so the public calculators still
// render if Supabase is unreachable or a product's tier list is empty.
export const DEFAULT_TERMS: BankProductTerms = {
  deposit: [
    { termMonths: 3, annualRatePct: 10 },
    { termMonths: 6, annualRatePct: 12 },
    { termMonths: 9, annualRatePct: 14 },
    { termMonths: 12, annualRatePct: 16 },
  ],
  credit: [
    { termMonths: 1, annualRatePct: 0 },
    { termMonths: 2, annualRatePct: 0 },
    { termMonths: 3, annualRatePct: 0 },
    { termMonths: 4, annualRatePct: 0.5 },
    { termMonths: 5, annualRatePct: 1 },
    { termMonths: 6, annualRatePct: 1.5 },
    { termMonths: 7, annualRatePct: 2.15 },
    { termMonths: 8, annualRatePct: 2.9 },
    { termMonths: 9, annualRatePct: 3.9 },
    { termMonths: 10, annualRatePct: 4.9 },
    { termMonths: 11, annualRatePct: 5.9 },
    { termMonths: 12, annualRatePct: 6.9 },
  ],
};

async function fetchBankProductTerms(): Promise<BankProductTerms> {
  const config = getSupabaseConfig();
  if (!config) return DEFAULT_TERMS;

  // Public data — a plain anon client (no cookies) keeps this cacheable.
  const supabase = createClient(config.url, config.anonKey);
  const { data, error } = await supabase
    .from("bank_product_terms")
    .select("product, term_months, annual_rate_pct")
    .order("term_months", { ascending: true });

  if (error || !data) {
    if (error) console.error("[bankTerms] fetch failed:", error);
    return DEFAULT_TERMS;
  }

  const deposit: ProductTerm[] = [];
  const credit: ProductTerm[] = [];
  for (const row of data) {
    const term = {
      termMonths: Number(row.term_months),
      annualRatePct: Number(row.annual_rate_pct),
    };
    if (!Number.isFinite(term.termMonths) || !Number.isFinite(term.annualRatePct)) continue;
    if (row.product === "deposit") deposit.push(term);
    else if (row.product === "credit") credit.push(term);
  }

  return {
    deposit: deposit.length > 0 ? deposit : DEFAULT_TERMS.deposit,
    credit: credit.length > 0 ? credit : DEFAULT_TERMS.credit,
  };
}

export const getBankProductTerms = unstable_cache(
  fetchBankProductTerms,
  ["bank-product-terms"],
  { revalidate: 60, tags: ["bank-terms"] },
);
