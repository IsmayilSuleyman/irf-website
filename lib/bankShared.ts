// Client-safe bank helpers. lib/bank.ts drags @googleapis/sheets +
// next/cache along, so anything a CLIENT component needs must live here
// (the same split as lib/bankTermsData). lib/bank re-exports these, so
// server-side imports keep working unchanged.

/** Fold Azerbaijani diacritics for fuzzy text matching (Ə→e, İ/ı→i, …). */
export function simplifyText(value: string): string {
  return value
    .replace(/[Əə]/g, "e")
    .replace(/[Iİıi]/g, "i")
    .replace(/[Öö]/g, "o")
    .replace(/[Üü]/g, "u")
    .replace(/[Ğğ]/g, "g")
    .replace(/[Şş]/g, "s")
    .replace(/[Çç]/g, "c");
}

// A schedule row is "paid" only when its status is EXACTLY one of İsmayıl's
// paid words ("Ödənildi" / "Ödənilmişdir" / "Ödəndi" / "Ödənmiş", compared
// after simplifyText folds the diacritics). Deliberately stricter than a
// substring check: an unpaid status such as "Ödəniləcək" also contains the
// "oden" root, so a substring test silently marks the whole loan as paid.
// The CreditPanel on /bank used exactly that loose test until the first
// outside borrower's schedule rendered "100% ödənilib" with nothing paid.
const PAID_STATUS_TOKENS = new Set([
  "odenildi",
  "odenilmisdir",
  "odendi",
  "odenmis",
  "paid",
]);

export function isPaymentPaid(status: string | null | undefined): boolean {
  const token = simplifyText(String(status ?? "")).trim().toLocaleLowerCase("en-US");
  return PAID_STATUS_TOKENS.has(token);
}
