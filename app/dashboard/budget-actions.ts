"use server";

import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/fundSettings";

/** Upper bound purely as a typo guard — a mis-keyed amount would otherwise
 *  drive a wildly wrong buy ticket. */
const MAX_WEEKLY_BUDGET_AZN = 1_000_000;

export async function saveWeeklyBudget(
  raw: string,
): Promise<{ ok: boolean; error?: string }> {
  const { user } = await getSupabaseServerUser();
  if (!user) return { ok: false, error: "Giriş tələb olunur." };
  if (!isOwnerEmail(user.email)) {
    return { ok: false, error: "İcazə yoxdur." };
  }

  // Accept both "300,50" and "300.50" — the UI shows AZN with a comma.
  const amount = Number(raw.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Düzgün məbləğ daxil edin." };
  }
  if (amount > MAX_WEEKLY_BUDGET_AZN) {
    return { ok: false, error: "Məbləğ həddindən böyükdür." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };

  const { error } = await supabase.from("fund_settings").upsert(
    {
      key: "weekly_budget_azn",
      value: amount.toFixed(2),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    console.error("weekly_budget_azn upsert failed:", error.message);
    return { ok: false, error: "Yadda saxlanılmadı." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Owner-only toggle between the weekly and monthly purchase cadence. */
export async function savePurchaseCadence(
  raw: string,
): Promise<{ ok: boolean; error?: string }> {
  const { user } = await getSupabaseServerUser();
  if (!user) return { ok: false, error: "Giriş tələb olunur." };
  if (!isOwnerEmail(user.email)) {
    return { ok: false, error: "İcazə yoxdur." };
  }
  if (raw !== "weekly" && raw !== "monthly") {
    return { ok: false, error: "Yanlış rejim." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };

  const { error } = await supabase.from("fund_settings").upsert(
    {
      key: "purchase_cadence",
      value: raw,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    console.error("purchase_cadence upsert failed:", error.message);
    return { ok: false, error: "Yadda saxlanılmadı." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
