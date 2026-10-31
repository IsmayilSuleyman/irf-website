"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SetExternalResult =
  | { ok: true; external: boolean }
  | { ok: false; error: string };

/**
 * Admin: flip one login between family and external member. The RPC is
 * is_fund_admin-gated and refuses admins and the caller's own row, so the
 * cabinet can never lock İsmayıl out.
 */
export async function setExternalMember(
  userId: string,
  external: boolean,
): Promise<SetExternalResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  }
  const { data, error } = await supabase.rpc("admin_set_external", {
    p_user_id: userId,
    p_external: external,
  });
  if (error) {
    console.error("[access] admin_set_external failed:", error);
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Bu əməliyyat üçün icazəniz yoxdur."
          : error.message || "Dəyişiklik yadda saxlanmadı.",
    };
  }
  revalidatePath("/bank");
  return { ok: true, external: data === true };
}
