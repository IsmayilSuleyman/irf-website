"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { displayNameOf } from "@/lib/user";

export type ClaimResult =
  | { ok: true; claimed: boolean; amountAzn: number; totalAzn: number }
  | { ok: false; error: string };

/**
 * Claim today's 0,10 ₼ login reward. The RPC is the single write path:
 * it stamps the Baku date server-side and the (user, day) primary key
 * makes a repeat claim a reported no-op — the client can't influence
 * either. holder_name rides along for the admin settlement view.
 */
export async function claimDailyReward(): Promise<ClaimResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sessiya tapılmadı — yenidən daxil olun." };
  }

  const { data, error } = await supabase.rpc("claim_daily_reward", {
    p_holder_name: displayNameOf(user.user_metadata) ?? "",
  });
  if (error) {
    console.error("[daily-reward] claim failed:", error);
    return { ok: false, error: "Mükafat götürülmədi — bir azdan yenidən yoxlayın." };
  }

  revalidatePath("/bank");
  const row = data as {
    claimed?: boolean;
    amount_azn?: number;
    total_azn?: number;
  } | null;
  return {
    ok: true,
    claimed: row?.claimed === true,
    amountAzn: Number(row?.amount_azn ?? 0),
    totalAzn: Number(row?.total_azn ?? 0),
  };
}

export type SettleResult =
  | { ok: true; settledCount: number; settledAzn: number }
  | { ok: false; error: string };

/**
 * Admin: mark one holder's unsettled reward claims settled — called AFTER
 * İsmayıl has moved the amount into the holder's Sheet deposit, so the
 * displayed deposit (sheet + unsettled rewards) never double-counts. The
 * RPC is is_fund_admin-gated server-side.
 */
export async function settleDailyRewards(
  holderName: string,
): Promise<SettleResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  }
  const { data, error } = await supabase.rpc("admin_settle_daily_rewards", {
    p_holder_name: holderName,
  });
  if (error) {
    console.error("[daily-reward] settle failed:", error);
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
