export function displayNameOf(
  meta: Record<string, unknown> | undefined,
): string | null {
  if (!meta) return null;
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.display_name as string) ||
    null
  );
}

/**
 * Title-cases a name using Azerbaijani casing rules. The dotted/dotless I is
 * the tricky part: "İSMAYIL" must become "İsmayıl" (dotless "ı"), not
 * "İsmayil". JS's default toLowerCase maps "I"→"i" and "İ"→"i̇" (with a
 * combining dot) — both wrong — so the two capital-I forms are mapped
 * explicitly before lowercasing the rest. Idempotent for already-cased input.
 * Splits on whitespace and hyphens so each name part is capitalized.
 */
export function toTitleCaseAz(name: string): string {
  const azLower = (s: string) =>
    s.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
  const azUpperFirst = (ch: string) =>
    ch === "i" ? "İ" : ch === "ı" ? "I" : ch.toUpperCase();

  return name
    .split(/(\s+|-)/) // keep whitespace runs and hyphens as separators
    .map((token) => {
      if (!token.trim()) return token;
      const lower = azLower(token);
      return azUpperFirst(lower[0]) + lower.slice(1);
    })
    .join("");
}

export function formatBakuDate(d: Date): string {
  return new Intl.DateTimeFormat("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Baku",
  }).format(d);
}
