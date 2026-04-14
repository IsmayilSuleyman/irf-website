import Link from "next/link";
import { IsmayilBankCalculator } from "@/components/IsmayilBankCalculator";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";

export default function IsmayilBankPage() {
  return (
    <main className="px-4 py-6 sm:px-6 sm:py-10">
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2.4rem] border border-blue-200/70 bg-white/72 p-6 shadow-[0_28px_80px_rgba(68,108,184,0.12)] backdrop-blur-xl sm:p-8 lg:p-12">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-300/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute left-[-4rem] top-[22%] h-44 w-44 rounded-full bg-sky-200/25 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-12 left-[12%] h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl"
        />

        <div className="relative">
          <div className="flex justify-center">
            <div className="inline-flex rounded-[1.2rem] border border-blue-200/70 bg-white/82 px-5 py-3 shadow-[0_16px_38px_rgba(66,96,175,0.12)]">
              <IsmayilBankLogo size={54} />
            </div>
          </div>

          <h1 className="mt-8 text-center text-[clamp(3rem,8vw,5rem)] font-black tracking-[-0.08em] text-[#161616]">
            İndi hesabla
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[1.1rem] leading-8 tracking-[-0.02em] text-black/52 sm:text-[1.2rem]">
            50–2000 ₼ arası kredit məbləğini və 1–12 ay müddəti seçin. Faiz dərəcəsi
            seçdiyiniz müddətə əsasən avtomatik hesablanır.
          </p>

          <div className="mt-10">
            <IsmayilBankCalculator />
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/welcome"
              className="inline-flex items-center justify-center rounded-[1rem] border border-black/10 bg-white/80 px-6 py-4 text-base font-semibold tracking-[-0.03em] text-black/65 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-[#2F61D8]"
            >
              Geri qayıt
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-[1rem] bg-[#1FA447] px-6 py-4 text-base font-semibold tracking-[-0.03em] text-white shadow-[0_16px_36px_rgba(31,164,71,0.24)] transition hover:-translate-y-0.5 hover:bg-[#19903d]"
            >
              İRF portfelinə keç
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
