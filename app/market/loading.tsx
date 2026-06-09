import { Bone, CardBones, HeaderBones } from "@/components/Skeleton";

// Shown instantly while the market state loads from Supabase + Sheets.
export default function MarketLoading() {
  return (
    <main className="px-6 pb-24">
      <HeaderBones />
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-end">
          <div className="flex flex-col gap-3 lg:col-span-2">
            <Bone className="h-9 w-32" />
            <Bone className="h-3 w-full max-w-xl" />
            <Bone className="h-3 w-3/4 max-w-md" />
          </div>
          <CardBones rows={3} className="lg:col-span-1" />
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <CardBones rows={6} />
          <CardBones rows={6} />
        </div>
        <CardBones rows={4} />
      </div>
    </main>
  );
}
