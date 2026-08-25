import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssetQuotes } from "@/lib/personalAssets";

// Fondumuz haqqında xəbərlər: dated posts by İsmayıl (title, body, optional
// picture). Fresh items — the last month — headline the dashboard; older
// ones stay reachable in the card's archive. Rows live in Supabase
// (fund_news, admin-write RLS).

export type FundNewsItem = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  /** Pre-formatted Baku date ("16 avqust 2026") — hydration-safe. */
  dateLabel: string;
  /** Optional pinned market ticker with its live daily change. */
  ticker: string | null;
  tickerPriceUsd: number | null;
  tickerDayPct: number | null;
};

export type FundNews = {
  fresh: FundNewsItem[];
  archive: FundNewsItem[];
};

const AZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

function bakuDateLabel(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms + 4 * 3_600_000); // Baku is fixed UTC+4
  return `${d.getUTCDate()} ${AZ_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** A month on the front page, the archive after. */
const FRESH_WINDOW_MS = 31 * 86_400_000;

export async function getFundNews(): Promise<FundNews> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { fresh: [], archive: [] };
  const { data, error } = await supabase
    .from("fund_news")
    .select("id,title,body,image_url,ticker,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[fund-news] fetch failed:", error.message);
    return { fresh: [], archive: [] };
  }
  const cutoff = Date.now() - FRESH_WINDOW_MS;
  // Pinned tickers get their live daily change in one quote round; a quote
  // outage just leaves the chips off.
  const tickers = [
    ...new Set(
      (data ?? [])
        .map((r) => (r.ticker ? String(r.ticker).toUpperCase() : null))
        .filter((t): t is string => t != null),
    ),
  ];
  const quotes = tickers.length > 0 ? await getAssetQuotes(tickers) : {};
  const items: FundNewsItem[] = (data ?? []).map((r) => {
    const ticker = r.ticker ? String(r.ticker).toUpperCase() : null;
    const q = ticker ? quotes[ticker] : undefined;
    return {
      id: String(r.id),
      title: String(r.title),
      body: String(r.body),
      imageUrl: r.image_url ? String(r.image_url) : null,
      createdAt: String(r.created_at),
      dateLabel: bakuDateLabel(String(r.created_at)),
      ticker,
      // Session price first — the chip breathes with the rest of the site.
      tickerPriceUsd: q?.extPriceUsd ?? q?.priceUsd ?? null,
      tickerDayPct:
        (q?.extPriceUsd ?? q?.priceUsd) != null &&
        q?.prevCloseUsd != null &&
        q.prevCloseUsd > 0
          ? (q.extPriceUsd ?? q.priceUsd)! / q.prevCloseUsd - 1
          : null,
    };
  });
  return {
    fresh: items.filter((i) => new Date(i.createdAt).getTime() >= cutoff),
    archive: items.filter((i) => new Date(i.createdAt).getTime() < cutoff),
  };
}
