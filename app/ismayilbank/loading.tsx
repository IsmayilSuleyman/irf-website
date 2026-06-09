import { Bone } from "@/components/Skeleton";

// Shown instantly while the bank liquidity snapshot loads from Sheets.
export default function IsmayilBankLoading() {
  return (
    <main className="min-h-screen bg-bank-section px-4 py-6 sm:px-6 sm:py-10">
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-hero border border-blue-200/70 dark:border-blue-400/25 bg-white/70 dark:bg-white/10 p-6 shadow-[0_28px_80px_rgba(68,108,184,0.12)] backdrop-blur-xl sm:p-8 lg:p-12">
        <div className="flex justify-center">
          <Bone className="h-16 w-44 rounded-card" />
        </div>
        <div className="mt-8 flex justify-center">
          <Bone className="h-12 w-72 sm:h-16 sm:w-[26rem]" />
        </div>
        <div className="mx-auto mt-6 max-w-3xl space-y-2">
          <Bone className="mx-auto h-3 w-full max-w-xl" />
          <Bone className="mx-auto h-3 w-3/4 max-w-md" />
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="rounded-card border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 p-5"
            >
              <Bone className="h-3 w-28" />
              <Bone className="mt-4 h-7 w-24" />
            </div>
          ))}
        </div>
        <Bone className="mt-12 h-72 w-full rounded-hero" />
        <Bone className="mt-8 h-72 w-full rounded-hero" />
      </section>
    </main>
  );
}
