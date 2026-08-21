// Client-safe half of lib/bankTerms: just the types and the hardcoded
// fallback tiers. The public calculators import from HERE — importing them
// through lib/bankTerms used to drag that module's server-only graph
// (supabase-js, next/cache and Next's OpenTelemetry shim) into the client
// bundle for /ismayilbank and /bank.

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
