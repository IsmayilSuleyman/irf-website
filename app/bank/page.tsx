import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBankAccountByName } from "@/lib/bank";
import { formatAzn } from "@/lib/portfolio";
import { StatTile } from "@/components/StatTile";
import { MotionSection } from "@/components/MotionSection";
import { BankHeader } from "@/components/BankHeader";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";

export const dynamic = "force-dynamic";

function displayNameOf(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.display_name as string) ||
    null
  );
}

function formatBakuDate(d: Date): string {
  return new Intl.DateTimeFormat("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Baku",
  }).format(d);
}

export default async function BankPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/bank");
  }

  const name = displayNameOf(user.user_metadata);
  const account = await getBankAccountByName(name);
  const dateLabel = formatBakuDate(new Date());

  if (!account) {
    return (
      <main className="px-6">
        <BankHeader dateLabel={dateLabel} />
        <div className="mx-auto max-w-5xl py-16 text-center">
          <h2 className="mb-2 text-lg font-semibold text-black">
            Bank hesabı tapılmadı
          </h2>
          <p className="text-sm text-black/55">
            Hesabınız ({user.email}) hələ İsmayılBank cədvəlindəki bir müştəriyə
            bağlanmayıb.
          </p>
          <p className="mt-4 text-sm text-black/45">
            user_metadata.full_name dəyəri bank sheet-dəki ad ilə eyni olmalıdır.
          </p>
          <div className="mt-8">
            <Link
              href="/portal"
              className="inline-flex rounded-[1rem] bg-[#2F61D8] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(47,97,216,0.24)] transition hover:-translate-y-0.5 hover:bg-[#2854be]"
            >
              Portala qayıt
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 pb-24">
      <BankHeader dateLabel={dateLabel} />

      <div className="mx-auto flex max-w-5xl flex-col gap-16">
        <MotionSection className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_0.85fr]">
          <div className="glass-strong overflow-hidden p-8 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-4">
                <div className="inline-flex rounded-[1.2rem] border border-blue-200/70 bg-white/82 px-4 py-3 shadow-[0_16px_38px_rgba(66,96,175,0.10)]">
                  <IsmayilBankLogo size={52} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2F61D8]/78">
                    Şəxsi bank hesabı
                  </p>
                  <h1 className="mt-2 text-[clamp(2.4rem,5vw,4.5rem)] font-black tracking-[-0.08em] text-[#161616]">
                    {account.name}
                  </h1>
                  <p className="mt-3 max-w-2xl text-[1.05rem] leading-7 tracking-[-0.02em] text-black/52">
                    Daxil olan istifadəçi üçün depozit məbləği və açıq cash loan
                    qalığı bu səhifədə göstərilir.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-black/10 bg-white/75 px-4 py-3 text-right shadow-[0_12px_30px_rgba(29,53,111,0.08)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">
                  Son yenilənmə
                </div>
                <div className="mt-1 text-sm font-medium text-black/70">
                  {account.updatedAt ?? dateLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-strong flex flex-col justify-between gap-6 p-8 sm:p-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2F61D8]/72">
                Xülasə
              </p>
              <p className="mt-3 text-[1.05rem] leading-7 tracking-[-0.02em] text-black/52">
                Bu görünüş yalnız bu girişə bağlı hesab üçün açıqlanır.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-[1rem] border border-black/10 bg-white/80 px-5 py-3 text-sm font-semibold tracking-[-0.03em] text-black/64 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-[#2F61D8]"
              >
                IRF portfeli
              </Link>
              <Link
                href="/ismayilbank"
                className="inline-flex items-center justify-center rounded-[1rem] bg-[#2F61D8] px-5 py-3 text-sm font-semibold tracking-[-0.03em] text-white shadow-[0_16px_36px_rgba(47,97,216,0.24)] transition hover:-translate-y-0.5 hover:bg-[#2854be]"
              >
                Kalkulyatora qayıt
              </Link>
            </div>
          </div>
        </MotionSection>

        <MotionSection delay={0.05}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StatTile
              label="Depozit cəmi"
              value={formatAzn(account.depositedAzn)}
              tone="positive"
              sub="Sheet-dəki ümumi depozit məbləği."
            />
            <StatTile
              label="Açıq cash loan"
              value={formatAzn(account.outstandingLoanAzn)}
              tone="negative"
              sub="Hazırda bağlanmamış kredit qalığı."
            />
            <StatTile
              label="Xalis mövqe"
              value={formatAzn(account.netAzn)}
              tone={account.netAzn >= 0 ? "positive" : "negative"}
              sub="Depozit minus outstanding loan."
            />
          </div>
        </MotionSection>
      </div>
    </main>
  );
}
