// Stable icon assignment per sector name, the icon twin of lib/sectorColors.
// Free-text sectors from the Watchlist sheet are keyword-matched (AZ + EN
// spellings) so the same sector always renders with the same glyph. Unmatched
// sectors fall back to a pie-slice — a literal "sector".

type IconKey =
  | "cash"
  | "communication"
  | "technology"
  | "metals"
  | "realEstate"
  | "etf"
  | "crypto"
  | "industry"
  | "discretionary"
  | "staples"
  | "health"
  | "energy"
  | "finance"
  | "utilities"
  | "fallback";

// Order matters: "Q.Zəruri İstehlak" contains "Zəruri İstehlak", so the
// discretionary test must run before the staples one.
const MATCHERS: [RegExp, IconKey][] = [
  [/nağd|cash/, "cash"],
  [/q\.?\s*zəruri|discretionary/, "discretionary"],
  [/zəruri|istehlak|staple/, "staples"],
  [/kommunikasiya|communic|telekom/, "communication"],
  [/texnologiya|tech/, "technology"],
  [/qiymətli|metal|qızıl|gold/, "metals"],
  [/əmlak|daşınmaz|real estate|reit/, "realEstate"],
  [/etf/, "etf"],
  [/kripto|crypto|bitkoin|bitcoin/, "crypto"],
  [/sənaye|industr/, "industry"],
  [/səhiyyə|tibb|health/, "health"],
  [/enerji|energy/, "energy"],
  [/maliyyə|financ|bank/, "finance"],
  [/kommunal|utilit/, "utilities"],
];

function iconKeyFor(sector: string): IconKey {
  // Azerbaijani "İ" lowercases to "i" + combining dot (U+0307) in JS; strip
  // the dot so /istehlak/ still matches "İstehlak".
  const s = sector.toLowerCase().replace(/̇/g, "");
  for (const [re, key] of MATCHERS) if (re.test(s)) return key;
  return "fallback";
}

// Lucide-style 24px stroke glyphs, tinted by the parent via currentColor.
const GLYPHS: Record<IconKey, React.ReactNode> = {
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  communication: (
    <>
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
    </>
  ),
  technology: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
    </>
  ),
  metals: (
    <>
      <path d="M9.8 7.5h4.4l1.5 5H8.3z" />
      <path d="M4.6 14.5H9l1.5 5H3.1z" />
      <path d="M15 14.5h4.4l1.5 5h-7.4z" />
    </>
  ),
  realEstate: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  etf: (
    <>
      <path d="m12 2 10 5-10 5L2 7Z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </>
  ),
  crypto: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 7.6v8.8" />
      <path d="M9.5 7.6h2.9a2.2 2.2 0 0 1 0 4.4H9.5" />
      <path d="M9.5 12h3.3a2.2 2.2 0 0 1 0 4.4H9.5" />
    </>
  ),
  industry: (
    <>
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M17 18h1M12 18h1M7 18h1" />
    </>
  ),
  discretionary: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  staples: (
    <>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </>
  ),
  health: (
    <>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </>
  ),
  energy: (
    <>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </>
  ),
  finance: (
    <>
      <path d="m12 2.5 9.5 6.5h-19Z" />
      <path d="M6 12v6M10 12v6M14 12v6M18 12v6" />
      <path d="M3 21.5h18" />
    </>
  ),
  utilities: (
    <>
      <path d="M9 8V2M15 8V2" />
      <path d="M6 8h12v4a6 6 0 0 1-12 0Z" />
      <path d="M12 18v4" />
    </>
  ),
  fallback: (
    <>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </>
  ),
};

export function SectorIcon({
  sector,
  className,
}: {
  sector: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {GLYPHS[iconKeyFor(sector)]}
    </svg>
  );
}
