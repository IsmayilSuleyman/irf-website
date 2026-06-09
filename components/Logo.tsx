export function Logo({
  width = 220,
  className = "",
  priority = false,
}: {
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src="/images/irf-logo.png"
      alt="Ismayil Rifah Fondu logo"
      // invert+hue-rotate flips the black wordmark to white in dark mode
      // while keeping the green cross close to its brand hue.
      className={`dark:invert dark:hue-rotate-180 ${className}`}
      style={{ width: "100%", maxWidth: width, height: "auto" }}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
