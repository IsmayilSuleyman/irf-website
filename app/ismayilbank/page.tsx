import Link from "next/link";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";

export default function IsmayilBankPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-blue-200/70 bg-white/72 p-8 shadow-[0_28px_80px_rgba(68,108,184,0.12)] backdrop-blur-xl sm:p-12">
        <div
          aria-hidden
          className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-blue-300/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-emerald-300/20 blur-3xl"
        />

        <div className="relative">
          <div className="mb-5 inline-flex rounded-[1.2rem] border border-blue-200/70 bg-white/82 px-5 py-3 shadow-[0_16px_38px_rgba(66,96,175,0.12)]">
            <IsmayilBankLogo size={54} />
          </div>
          <p className="sr-only">
            İSMAYILBANK
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[#222222] sm:text-5xl">
            Maliyyə məhsulları tezliklə burada olacaq
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 tracking-[-0.02em] text-black/55">
            Bu bölmə üçün depozit və kredit müqayisələri hazırlanır. Hələlik
            investor portalına keçə və ya ana səhifəyə geri dönə
            bilərsiniz.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5 text-sm text-black/45">
            <span className="rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1.5">
              Depozit
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1.5">
              Kredit
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1.5">
              Müqayisə
            </span>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
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
