import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getStrategyStatement(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return "";

  const { data, error } = await supabase
    .from("fund_settings")
    .select("value")
    .eq("key", "strategy_statement")
    .maybeSingle();

  if (error) {
    console.error("fund_settings read failed:", error.message);
    return "";
  }

  return data?.value ?? "";
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner;
}
