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
      className={className}
      style={{ width: "100%", maxWidth: width, height: "auto" }}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
