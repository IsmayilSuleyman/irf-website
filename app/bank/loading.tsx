import { Bone, HeaderBones } from "@/components/Skeleton";

// Shown instantly while the bank account's Google Sheets fetch runs.
export default function BankLoading() {
  return (
    <main className="min-h-screen bg-bank-section">
      <HeaderBones tint="blue" />
      <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <Bone className="h-3 w-64" />
        <Bone className="mt-8 h-3 w-36" />
        <Bone className="mt-4 h-12 w-60 sm:h-16 sm:w-72" />
        <Bone className="mt-4 h-3 w-80 max-w-full" />

        <Bone className="mt-14 h-5 w-56" />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="rounded-card border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 p-5"
            >
              <Bone className="h-3 w-24" />
              <Bone className="mt-4 h-7 w-20" />
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-card border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 p-6">
          <div className="flex items-center justify-between">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-20" />
          </div>
          <div className="mt-6 space-y-5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Bone className="h-4 w-32" />
                  <Bone className="mt-2 h-3 w-24" />
                </div>
                <Bone className="h-6 w-24 rounded-full" />
                <Bone className="h-4 w-14" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
