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
