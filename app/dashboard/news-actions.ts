"use server";

import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/fundSettings";

// Fondumuz haqqında xəbərlər: İsmayıl posts and removes items. RLS
// (is_fund_admin) enforces the write gate; the owner-email check here just
// fails fast with a readable message.

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
  // Yahoo-style symbols only: SPY, BTC-USD, ^GSPC, GC=F...
  const ticker =
    input.ticker
      ?.trim()
      .toUpperCase()
      .replace(/[^A-Z0-9^.=\-]/g, "")
      .slice(0, 12) || null;

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
