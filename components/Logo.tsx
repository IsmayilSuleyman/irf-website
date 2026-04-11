export function Logo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  // viewBox is 200 × 145; width scales proportionally from height
  const width = Math.round(size * (200 / 145));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 145"
      width={width}
      height={size}
      className={className}
      role="img"
      aria-label="İRF – İsmayıl Rifah Fondu"
    >
      <defs>
        <linearGradient id="irf-star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5C842" />
          <stop offset="100%" stopColor="#C8860A" />
        </linearGradient>
        <linearGradient id="irf-trail1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C8860A" stopOpacity="0" />
          <stop offset="100%" stopColor="#D4A520" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="irf-trail2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C8860A" stopOpacity="0" />
          <stop offset="100%" stopColor="#D4A520" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="irf-trail3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C8860A" stopOpacity="0" />
          <stop offset="100%" stopColor="#D4A520" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {/* Comet trails — from lower-left tip toward the star */}
      <line
        x1="4" y1="60" x2="41" y2="31"
        stroke="url(#irf-trail1)" strokeWidth="2.8" strokeLinecap="round"
      />
      <line
        x1="12" y1="65" x2="41" y2="38"
        stroke="url(#irf-trail2)" strokeWidth="2" strokeLinecap="round"
      />
      <line
        x1="22" y1="67" x2="41" y2="45"
        stroke="url(#irf-trail3)" strokeWidth="1.4" strokeLinecap="round"
      />

      {/* 5-point star — center (55, 28), outer r=17, inner r=7.5 */}
      <path
        d="M55,11 L59.37,22.01 L71.18,22.79 L62.24,29.96 L65.01,41.49 L55,35.2 L44.99,41.49 L47.76,29.96 L38.82,22.79 L50.63,22.01 Z"
        fill="url(#irf-star-grad)"
      />

      {/* IRF — bold, near-black */}
      <text
        x="100"
        y="106"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif"
        fontWeight="900"
        fontSize="72"
        fill="#0d0d0d"
        letterSpacing="-1"
      >
        IRF
      </text>

      {/* İSMAYIL RİFAH FONDU */}
      <text
        x="100"
        y="130"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
        fontWeight="500"
        fontSize="10.5"
        fill="#0d0d0d"
        letterSpacing="2.6"
      >
        İSMAYIL RİFAH FONDU
      </text>
    </svg>
  );
}
