export function Logo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="İRF"
    >
      <path
        d="M16 4 L17.6 9.4 L23 9.8 L18.7 13.4 L20.2 19 L16 16 L11.8 19 L13.3 13.4 L9 9.8 L14.4 9.4 Z"
        fill="#16a34a"
      />
      <text
        x="16"
        y="29"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="10"
        fill="#16a34a"
        letterSpacing="-0.3"
      >
        İRF
      </text>
    </svg>
  );
}
