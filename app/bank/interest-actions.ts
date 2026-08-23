"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SettleInterestResult =
  | { ok: true; settledCount: number; settledAzn: number }
  | { ok: false; error: string };

/**
 * Admin: mark one holder's unsettled interest accruals settled — called
 * AFTER İsmayıl has moved the amount into the holder's Sheet deposit, so
 * the displayed deposit (sheet + unsettled interest) never double-counts.
 * The RPC is is_fund_admin-gated server-side.
 */
export async function settleBankInterest(
  holderName: string,
): Promise<SettleInterestResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  }
  const { data, error } = await supabase.rpc("admin_settle_bank_interest", {
    p_holder_name: holderName,
  });
  if (error) {
    console.error("[bank-interest] settle failed:", error);
    return { ok: false, error: "Hesablaşma alınmadı." };
  }
  revalidatePath("/bank");
  const row = data as { settled_count?: number; settled_azn?: number } | null;
  return {
    ok: true,
    settledCount: Number(row?.settled_count ?? 0),
    settledAzn: Number(row?.settled_azn ?? 0),
  };
}
