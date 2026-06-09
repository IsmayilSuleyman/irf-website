// Shimmer placeholder primitives for route loading states (loading.tsx).
// Bone = one pulsing block; compose them to sketch the page's layout so
// the swap to real content doesn't shift things around.

export function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-black/10 dark:bg-white/10 ${className}`}
    />
  );
}

// Sticky header strip matching Header/BankHeader dimensions.
export function HeaderBones({ tint = "green" }: { tint?: "green" | "blue" }) {
  const border =
    tint === "green" ? "border-brand-green/15" : "border-bank-blue/15";
  return (
    <div
      className={`sticky top-0 z-40 mb-12 border-b ${border} bg-white/55 dark:bg-white/5 px-6 backdrop-blur-md`}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-4">
          <Bone className="h-8 w-36 sm:w-44" />
          <Bone className="hidden h-9 w-28 sm:block" />
        </div>
        <div className="flex items-center gap-4">
          <Bone className="h-5 w-5 rounded-full" />
          <Bone className="hidden h-3 w-20 sm:block" />
          <Bone className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

// Hero block: small eyebrow label, big number, meta line, chip row.
export function HeroBones() {
  return (
    <div>
      <Bone className="h-3 w-52" />
      <Bone className="mt-5 h-12 w-64 sm:h-16 sm:w-80" />
      <Bone className="mt-4 h-3 w-72 max-w-full" />
      <Bone className="mt-2 h-3 w-56 max-w-full" />
      <div className="mt-6 flex flex-wrap gap-3">
        <Bone className="h-9 w-44 rounded-full" />
        <Bone className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}

// Glass card with a label row and `rows` content lines.
export function CardBones({
  rows = 3,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`glass p-6 ${className}`}>
      <Bone className="h-3 w-32" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Bone className="h-3 w-24" />
            <Bone className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
