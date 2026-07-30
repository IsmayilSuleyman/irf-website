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

/**
 * The weekly contribution the buy ticket splits, in AZN. 0 means "not set" —
 * the ticket still ranks the picks, it just has no amounts to divide.
 */
export async function getWeeklyBudgetAzn(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from("fund_settings")
    .select("value")
    .eq("key", "weekly_budget_azn")
    .maybeSingle();

  if (error) {
    console.error("fund_settings read failed:", error.message);
    return 0;
  }

  const parsed = Number(String(data?.value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner;
}
