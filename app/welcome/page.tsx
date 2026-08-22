import { WelcomeView } from "./WelcomeView";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showSetupNotice = params.setup === "supabase";

  return (
    <main className="min-h-screen overflow-hidden p-1.5 sm:p-2">
      <section className="relative mx-auto min-h-[calc(100vh-0.75rem)] max-w-[1920px] overflow-hidden rounded-3xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.8),rgba(242,250,245,0.88)_48%,rgba(229,246,235,0.9))] shadow-[0_28px_90px_rgba(48,94,63,0.08)] dark:border-white/15 dark:bg-none dark:bg-white/5">
        {/* Two soft washes instead of the old flotilla of glass shapes: one
            behind the hero text, one behind the preview card. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,255,255,0.75),rgba(255,255,255,0)_34%),radial-gradient(circle_at_82%_38%,rgba(205,244,219,0.55),rgba(205,244,219,0)_30%)] dark:opacity-[0.07]"
        />
        <WelcomeView
          showSetupNotice={showSetupNotice}
          year={new Date().getFullYear()}
        />
      </section>
    </main>
  );
}
