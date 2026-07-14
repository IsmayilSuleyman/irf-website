import { Bone, CardBones } from "@/components/Skeleton";

// Shown instantly while the bond market state loads from Supabase.
export default function BondsLoading() {
  return (
    <main className="min-h-screen bg-bank-section">
      <div className="border-b border-black/10 dark:border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Bone className="h-8 w-36" />
          <Bone className="h-8 w-24" />
        </div>
      </div>
      <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <Bone className="h-3 w-40" />
        <Bone className="mt-3 h-9 w-56" />
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <CardBones rows={3} />
          <CardBones rows={3} />
          <CardBones rows={3} />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <CardBones rows={6} />
          <CardBones rows={6} />
        </div>
        <div className="mt-8">
          <CardBones rows={4} />
        </div>
      </section>
    </main>
  );
}
