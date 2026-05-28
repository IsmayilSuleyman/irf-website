// AZN amounts and unit counts are formatted manually rather than via
// Intl.NumberFormat("az-AZ", …). The browser's "az-AZ" locale data doesn't
// match Node's: it falls back to comma-thousands / dot-decimal and renders
// currency as "AZN 1,234.56" instead of "1.234,56 ₼", so Intl produced
// different strings on the server and client — a hydration mismatch. Manual
// grouping guarantees the server and client render identically.

// Non-breaking space so the ₼ symbol never wraps onto its own line.
export const NBSP = String.fromCharCode(0xa0);

// Insert "." as the thousands separator: 1234567 -> "1.234.567".
export const groupThousands = (intPart: string) =>
  intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// "." thousands separator, "," decimal, fixed to `decimals` places (keeps
// trailing zeros). Number-only — callers append their own ₼/% suffix.
export const formatGrouped = (n: number, decimals: number) => {
  const neg = n < 0;
  const [intPart, decPart] = Math.abs(n).toFixed(decimals).split(".");
  return `${neg ? "-" : ""}${groupThousands(intPart)}${decPart ? `,${decPart}` : ""}`;
};

// Like formatGrouped but rounds to at most `maxDecimals` places and drops
// trailing zeros (2.90 -> "2,9", 12.00 -> "12"). Number-only.
export const formatGroupedTrim = (n: number, maxDecimals: number) => {
  const neg = n < 0;
  const [intPart, decRaw] = Math.abs(n).toFixed(maxDecimals).split(".");
  const decPart = (decRaw ?? "").replace(/0+$/, "");
  return `${neg ? "-" : ""}${groupThousands(intPart)}${decPart ? `,${decPart}` : ""}`;
};

export const formatAzn = (n: number) => `${formatGrouped(n, 2)}${NBSP}₼`;

export const formatPct = (n: number) => `${(n * 100).toFixed(2)}%`;

export const formatUnits = (n: number) => formatGroupedTrim(n, 4);
