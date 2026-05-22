import { requireUser } from "@/lib/auth-guard";
import { getMarketData } from "@/lib/market";
import { formatBakuDate } from "@/lib/user";
import { Header } from "@/components/Header";
import { MotionSection } from "@/components/MotionSection";
import { PriceBadge } from "@/components/PriceBadge";
import { OrderTicket } from "@/components/market/OrderTicket";
import { OrderBook } from "@/components/market/OrderBook";
import { MyOrders } from "@/components/market/MyOrders";
import { MyMatches } from "@/components/market/MyMatches";
import { AdminSettlements } from "@/components/market/AdminSettlements";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  await requireUser("/market");
  const data = await getMarketData();
  const dateLabel = formatBakuDate(new Date());

  if (!data) {
    return (
      <main className="px-6">
        <Header dateLabel={dateLabel} />
        <div className="mx-auto max-w-5xl py-16 text-center text-sm text-black/55">
          Bazar məlumatları yüklənmədi.
        </div>
      </main>
    );
  }

  const notConfigured = data.status.unit_price <= 0;

  return (
    <main className="px-6 pb-24">
      <Header dateLabel={dateLabel} />

      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        {/* Intro + price band */}
        <MotionSection className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-end">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <h1 className="text-3xl font-black tracking-tight text-black">Bazar</h1>
            <p className="max-w-xl text-sm leading-relaxed text-black/55">
              Payları alıb-satın. Fond hər zaman <span className="font-medium text-brand-red">Satış</span>{" "}
              qiyməti ilə geri alır; daha yüksək qiymətə satmaq üçün alıcı tapılmalıdır.
              Uyğunlaşmalar İsmayıl tərəfindən təsdiqlənənə qədər gözləmədə qalır.
            </p>
          </div>
          <div className="lg:col-span-1">
            <PriceBadge current={data.status.unit_price} />
          </div>
        </MotionSection>

        {data.isAdmin && (
          <MotionSection delay={0.05}>
            <AdminSettlements pending={data.adminPending} />
          </MotionSection>
        )}

        {notConfigured ? (
          <MotionSection delay={0.1}>
            <div className="glass p-8 text-center text-sm text-black/55">
              {data.isAdmin
                ? "Bazar hələ qurulmayıb. Başlamaq üçün yuxarıdakı “Cədvəldən sinxronla” düyməsinə basın."
                : "Bazar hələ aktiv deyil. Zəhmət olmasa İsmayıl ilə əlaqə saxlayın."}
            </div>
          </MotionSection>
        ) : (
          <>
            <MotionSection delay={0.1} className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <OrderTicket status={data.status} availableToSell={data.availableToSell} />
              <OrderBook book={data.book} status={data.status} />
            </MotionSection>

            <MotionSection delay={0.15}>
              <MyOrders orders={data.myOrders} />
            </MotionSection>

            <MotionSection delay={0.2}>
              <MyMatches
                trades={data.myTrades}
                userId={data.user.id}
                holderName={data.holderName}
              />
            </MotionSection>
          </>
        )}
      </div>
    </main>
  );
}
