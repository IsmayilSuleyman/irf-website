"use client";

import { useRef, useState, useTransition } from "react";
import { deleteFundNews, postFundNews } from "@/app/dashboard/news-actions";
import type { FundNews, FundNewsItem } from "@/lib/fundNews";

// Fondumuz haqqında xəbərlər: dated posts from İsmayıl, each rendered as a
// green fund-styled banner (the credit-offer banner's composition, in the
// fund's colors). Fresh items — the last month — show in full; older ones
// live in the collapsible archive below. İsmayıl gets a compose form with
// an optional picture (uploaded to the public `news` bucket).

const fmtPct = (p: number) =>
  `${p >= 0 ? "+" : "−"}${(Math.abs(p) * 100).toFixed(2).replace(".", ",")}%`;

/** The pinned ticker's live day change — ▲/▼ carries the polarity so it
 *  stays readable on the green banner. */
function TickerChip({ item }: { item: FundNewsItem }) {
  if (!item.ticker || item.tickerDayPct == null) return null;
  const up = item.tickerDayPct >= 0;
  return (
    <span className="num inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-semibold">
      {item.ticker}
      {item.tickerPriceUsd != null ? (
        <span className="text-white/75">
          {item.tickerPriceUsd.toFixed(2).replace(".", ",")}$
        </span>
      ) : null}
      <span className={up ? "text-emerald-100" : "text-rose-200"}>
        {up ? "▲" : "▼"} {fmtPct(item.tickerDayPct)}
      </span>
    </span>
  );
}

function NewsBanner({
  item,
  canPost,
  onDelete,
  deleting,
}: {
  item: FundNewsItem;
  canPost: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    // A black plate (deliberately the same in both themes, like the bond
    // certificates): white text reads crisply, the fund speaks through the
    // green accents — date, border, glow.
    <article className="relative overflow-hidden rounded-2xl border border-brand-green/25 bg-[linear-gradient(135deg,#0e1411,#18211b)] p-5 text-white sm:p-6">
      <div
        aria-hidden
        className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-brand-green/15 blur-2xl"
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className="num text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
            {item.dateLabel}
          </p>
          {canPost ? (
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              disabled={deleting}
              className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55 transition hover:text-white disabled:opacity-50"
            >
              Sil
            </button>
          ) : null}
        </div>
        {/* The picture floats as a compact square on the right: the title
            wraps beside it, and the body reclaims the full card width as
            soon as it clears the square (flow-root contains the float). */}
        <div className="flow-root">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="float-right mb-2 ml-4 mt-2 h-24 w-24 rounded-xl border border-white/20 object-cover shadow-[0_10px_28px_rgba(0,0,0,0.2)] sm:h-28 sm:w-28"
            />
          ) : null}
          <h3 className="mt-2 text-[clamp(1.15rem,2.6vw,1.45rem)] font-black tracking-[-0.03em]">
            {item.title}
          </h3>
          {item.ticker && item.tickerDayPct != null ? (
            <div className="mt-2">
              <TickerChip item={item} />
            </div>
          ) : null}
          <p className="mt-2.5 whitespace-pre-line text-[13px] leading-6 text-white/85">
            {item.body}
          </p>
        </div>
      </div>
    </article>
  );
}

export function FundNewsCard({
  news,
  canPost,
}: {
  news: FundNews;
  canPost: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      let imageUrl: string | null = null;
      const file = fileRef.current?.files?.[0];
      if (file) {
        // Upload from the browser: the storage policy only admits the fund
        // admin, so a rejected upload is an auth answer, not a bug. The
        // supabase client loads lazily — only İsmayıl's upload path pays
        // for it, not every dashboard visitor's bundle.
        const { createSupabaseBrowserClient } = await import(
          "@/lib/supabase/client"
        );
        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          setError("Supabase konfiqurasiya olunmayıb.");
          return;
        }
        setUploadPct("Şəkil yüklənir...");
        const ext = (file.name.split(".").pop() || "img")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 5);
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("news")
          .upload(path, file, { contentType: file.type || undefined });
        setUploadPct(null);
        if (upErr) {
          setError(`Şəkil yüklənmədi: ${upErr.message}`);
          return;
        }
        imageUrl = supabase.storage.from("news").getPublicUrl(path).data
          .publicUrl;
      }
      const result = await postFundNews({ title, body, imageUrl, ticker });
      if (!result.ok) {
        setError(result.error ?? "Xəta baş verdi.");
        return;
      }
      setTitle("");
      setBody("");
      setTicker("");
      if (fileRef.current) fileRef.current.value = "";
      setComposing(false);
    });
  }

  function onDelete(id: string) {
    if (!window.confirm("Bu xəbər silinsin?")) return;
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteFundNews(id);
      setDeletingId(null);
      if (!result.ok) setError(result.error ?? "Silinmədi.");
    });
  }

  const empty = news.fresh.length === 0 && news.archive.length === 0;

  return (
    <div className="glass flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
          Fondumuz haqqında xəbərlər
        </div>
        {canPost && !composing ? (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="text-[11px] uppercase tracking-[0.18em] text-brand-green transition-colors hover:text-brand-green-deep dark:text-emerald-400"
          >
            Yeni xəbər
          </button>
        ) : null}
      </div>

      {composing ? (
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Başlıq"
            disabled={pending}
            className="w-full rounded-lg border border-black/10 bg-white/60 p-3 text-sm font-semibold text-black/85 outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30 dark:border-white/15 dark:bg-white/5 dark:text-white/90"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={8000}
            placeholder="Xəbərin mətni..."
            disabled={pending}
            className="w-full resize-y rounded-lg border border-black/10 bg-white/60 p-3 text-sm text-black/85 outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30 dark:border-white/15 dark:bg-white/5 dark:text-white/90"
          />
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            maxLength={12}
            placeholder="Ticker (istəyə bağlı — məs. SPY, BTC-USD, GC=F)"
            disabled={pending}
            className="num w-full rounded-lg border border-black/10 bg-white/60 p-3 text-sm uppercase text-black/85 outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30 dark:border-white/15 dark:bg-white/5 dark:text-white/90"
          />
          <label className="flex flex-wrap items-center gap-2 text-[12px] text-black/55 dark:text-white/60">
            Şəkil (istəyə bağlı):
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              disabled={pending}
              className="text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-brand-green/10 file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-brand-green dark:file:text-emerald-400"
            />
          </label>
          {uploadPct ? (
            <div className="text-xs text-black/50 dark:text-white/55">{uploadPct}</div>
          ) : null}
          {error ? (
            <div className="text-xs text-brand-red dark:text-red-400">{error}</div>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setComposing(false);
                setError(null);
              }}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-xs text-black/55 transition-colors hover:text-black/85 disabled:opacity-50 dark:text-white/60 dark:hover:text-white/90"
            >
              Ləğv et
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={pending || !title.trim() || !body.trim()}
              className="rounded-md bg-brand-green px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-green-deep disabled:opacity-50"
            >
              {pending ? "Dərc olunur..." : "Dərc et"}
            </button>
          </div>
        </div>
      ) : null}

      {news.fresh.length > 0 ? (
        <div className="flex flex-col gap-3">
          {news.fresh.map((item) => (
            <NewsBanner
              key={item.id}
              item={item}
              canPost={canPost}
              onDelete={onDelete}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      ) : !composing ? (
        <p className="text-sm text-black/45 dark:text-white/50">
          {empty
            ? canPost
              ? "İlk xəbəri dərc etmək üçün «Yeni xəbər»ə bas."
              : "Hələ xəbər yoxdur."
            : "Bu ay yeni xəbər yoxdur — köhnələri arxivdə tapılır."}
        </p>
      ) : null}

      {!error && !composing && news.archive.length > 0 ? null : error &&
        !composing ? (
        <div className="text-xs text-brand-red dark:text-red-400">{error}</div>
      ) : null}

      {news.archive.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 transition-colors hover:text-black/70 dark:text-white/50 dark:hover:text-white/75">
            Arxiv ({news.archive.length}){" "}
            <span className="inline-block transition-transform group-open:rotate-90">
              ▸
            </span>
          </summary>
          <div className="mt-3 flex flex-col divide-y divide-black/[0.06] dark:divide-white/10">
            {news.archive.map((item) => (
              <details key={item.id} className="py-2.5">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4">
                  <span className="text-[13px] font-medium text-black/75 dark:text-white/80">
                    {item.title}
                  </span>
                  <span className="num shrink-0 text-[11px] text-black/40 dark:text-white/45">
                    {item.dateLabel}
                  </span>
                </summary>
                <div className="mt-2 flow-root">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="float-right mb-1.5 ml-3 h-16 w-16 rounded-lg object-cover"
                    />
                  ) : null}
                  <p className="whitespace-pre-line text-[13px] leading-6 text-black/60 dark:text-white/65">
                    {item.body}
                  </p>
                </div>
                {canPost ? (
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-red/70 transition hover:text-brand-red disabled:opacity-50 dark:text-red-400/70 dark:hover:text-red-400"
                  >
                    Sil
                  </button>
                ) : null}
              </details>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
