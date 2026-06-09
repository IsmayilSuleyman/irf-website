import { Bone, CardBones, HeaderBones, HeroBones } from "@/components/Skeleton";

// Shown instantly while the dashboard's Google Sheets + Supabase fetches run.
export default function DashboardLoading() {
  return (
    <main className="px-6 pb-24">
      <HeaderBones />
      <div className="mx-auto max-w-5xl">
        <HeroBones />
        <CardBones rows={3} className="mt-10" />
        <div className="glass mt-6 p-6">
          <Bone className="h-3 w-44" />
          <div className="mt-5 flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Bone key={i} className="h-8 w-16 rounded-full" />
            ))}
          </div>
          <Bone className="mt-6 h-64 w-full rounded-xl" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <CardBones rows={5} />
          <CardBones rows={5} />
        </div>
      </div>
    </main>
  );
}
