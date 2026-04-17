// Stable color assignment per sector name. Free-text sectors from the
// Watchlist sheet get a deterministic slot in PALETTE so the same sector
// always renders with the same color across pie, list, and breakdown.

const PALETTE = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#14b8a6", // teal
  "#0ea5e9", // sky
  "#eab308", // yellow
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ef4444", // red
  "#a855f7", // purple
  "#22c55e", // emerald
];

const CASH_COLOR = "#16a34a"; // brand green — distinguishes the Cash bucket
const UNKNOWN_COLOR = "#94a3b8"; // slate — for blank / "Naməlum"

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function sectorColor(sector: string | null | undefined): string {
  if (!sector) return UNKNOWN_COLOR;
  const s = sector.trim();
  if (/^cash$/i.test(s) || /nağd/i.test(s)) return CASH_COLOR;
  if (/naməlum|unknown/i.test(s)) return UNKNOWN_COLOR;
  return PALETTE[hash(s.toLowerCase()) % PALETTE.length];
}

export function mixWithWhite(hex: string, amount: number): string {
  const a = Math.max(0, Math.min(1, amount));
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * a);
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}
