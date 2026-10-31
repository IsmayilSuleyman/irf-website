"use server";

import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/fundSettings";
import { isNewsEditable } from "@/lib/fundNews";

// Fondumuz haqqında xəbərlər: İsmayıl posts, edits (for a week after
// publishing) and removes items. RLS (is_fund_admin) enforces the write
// gate; the owner-email check here just fails fast with a readable message.

/** Yahoo-style symbols only: SPY, BTC-USD, ^GSPC, GC=F... */
function cleanTicker(raw: string | null | undefined): string | null {
  return (
    raw
      ?.trim()
      .toUpperCase()
      .replace(/[^A-Z0-9^.=\-]/g, "")
      .slice(0, 12) || null
  );
}

export async function postFundNews(input: {
  title: string;
  body: string;
  imageUrl?: string | null;
  ticker?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { user } = await getSupabaseServerUser();
  if (!user) return { ok: false, error: "Giriş tələb olunur." };
  if (!isOwnerEmail(user.email)) return { ok: false, error: "İcazə yoxdur." };

  const title = input.title.trim().slice(0, 200);
  const body = input.body.trim().slice(0, 8000);
  if (!title || !body) {
    return { ok: false, error: "Başlıq və mətn boş ola bilməz." };
  }
  const imageUrl = input.imageUrl?.trim() || null;
  const ticker = cleanTicker(input.ticker);

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  }
  const { error } = await supabase.from("fund_news").insert({
    title,
    body,
    image_url: imageUrl,
    ticker,
    created_by: user.id,
  });
  if (error) {
    console.error("[fund-news] insert failed:", error.message);
    return { ok: false, error: "Yadda saxlanılmadı." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Rewrites a post inside its edit window. `imageUrl`: undefined keeps the
 *  current picture, null removes it, a string replaces it. The date stays
 *  the publication date. */
export async function updateFundNews(
  id: string,
  input: {
    title: string;
    body: string;
    imageUrl?: string | null;
    ticker?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { user } = await getSupabaseServerUser();
  if (!user) return { ok: false, error: "Giriş tələb olunur." };
  if (!isOwnerEmail(user.email)) return { ok: false, error: "İcazə yoxdur." };

  const title = input.title.trim().slice(0, 200);
  const body = input.body.trim().slice(0, 8000);
  if (!title || !body) {
    return { ok: false, error: "Başlıq və mətn boş ola bilməz." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  }
  const { data: row, error: readErr } = await supabase
    .from("fund_news")
    .select("created_at")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !row) return { ok: false, error: "Xəbər tapılmadı." };
  if (!isNewsEditable(String(row.created_at))) {
    return {
      ok: false,
      error: "Dərcdən 7 gün keçib — xəbər artıq redaktə olunmur.",
    };
  }

  const patch: Record<string, string | null> = {
    title,
    body,
    ticker: cleanTicker(input.ticker),
  };
  if (input.imageUrl !== undefined) {
    patch.image_url = input.imageUrl?.trim() || null;
  }
  const { error } = await supabase
    .from("fund_news")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[fund-news] update failed:", error.message);
    return { ok: false, error: "Yadda saxlanılmadı." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteFundNews(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { user } = await getSupabaseServerUser();
  if (!user) return { ok: false, error: "Giriş tələb olunur." };
  if (!isOwnerEmail(user.email)) return { ok: false, error: "İcazə yoxdur." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  }
  const { error } = await supabase.from("fund_news").delete().eq("id", id);
  if (error) {
    console.error("[fund-news] delete failed:", error.message);
    return { ok: false, error: "Silinmədi." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
