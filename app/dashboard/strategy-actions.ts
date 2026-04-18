"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/fundSettings";

export async function saveStrategyStatement(
  raw: string,
): Promise<{ ok: boolean; error?: string }> {
  const { user } = await getSupabaseServerUser();
  if (!user) return { ok: false, error: "Giriş tələb olunur." };
  if (!isOwnerEmail(user.email)) {
    return { ok: false, error: "İcazə yoxdur." };
  }

  const value = raw.slice(0, 4000);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };

  const { error } = await supabase
    .from("fund_settings")
    .upsert(
      { key: "strategy_statement", value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    console.error("strategy_statement upsert failed:", error.message);
    return { ok: false, error: "Yadda saxlanılmadı." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
