"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FOUNDER_MODE_KEY } from "@/lib/founderMode";

export type FounderModeResult = { ok: true; on: boolean } | { ok: false; error: string };

/**
 * Admin: switch Təsisçi rejimi on or off. Gated on is_fund_admin (the
 * admin_users table) server-side; fund_settings' own write policy is the
 * wide authenticated one every setting shares, so this action is the gate.
 */
export async function setFounderMode(on: boolean): Promise<FounderModeResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_fund_admin");
  if (adminError || isAdmin !== true) {
    return { ok: false, error: "İcazə yoxdur." };
  }

  const { error } = await supabase.from("fund_settings").upsert(
    {
      key: FOUNDER_MODE_KEY,
      value: on ? "on" : "off",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) {
    console.error("[founder-mode] upsert failed:", error.message);
    return { ok: false, error: "Yadda saxlanılmadı." };
  }

  revalidateTag("bank-founder-mode");
  revalidatePath("/bank");
  return { ok: true, on };
}
