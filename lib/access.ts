import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who may see what, once signed in.
 *
 * - "family": the İRF portfolio, the whole bank (including the bank-wide
 *   transparency view), the bond market and the share market.
 * - "external": someone outside the family who banks with İsmayılBank
 *   (first case: a groupmate with a loan). He gets the same products —
 *   deposit, credit, bonds, İRF shares — minus the family views: no
 *   /dashboard (holdings, the shareholder list by name) and no bank-wide
 *   view (every depositor and borrower by name). Share purchases of all
 *   externals TOGETHER are capped at fund_config.external_cap_pct of the
 *   fund (2%: with the 10% float cap that leaves the family 8%), enforced
 *   in the place_order RPC.
 *
 * Membership lives in the server-controlled `external_users` table
 * (mirrors `admin_users`); nothing client-writable takes part. Read through
 * the `is_external_user` RPC so the decision is one definer call.
 */
export type AccessScope = "family" | "external";

/**
 * Fails OPEN to "family": a transient RPC error must not strand the family
 * on /bank, and the migration may not be applied yet on a fresh branch
 * (then nobody is external anyway). The pages an external member is kept
 * off are family data, not secrets — the redirect is a courtesy wall; the
 * share cap, the one rule with money behind it, lives in the database.
 */
export async function getAccessScope(
  supabase: SupabaseClient | null,
): Promise<AccessScope> {
  if (!supabase) return "family";
  const { data, error } = await supabase.rpc("is_external_user");
  if (error) {
    console.error("[access] is_external_user failed:", error);
    return "family";
  }
  return data === true ? "external" : "family";
}

export type AppUser = {
  userId: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  external: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

/** Admin only (RPC raises 42501 otherwise) — every auth user with flags. */
export async function listAppUsers(
  supabase: SupabaseClient,
): Promise<AppUser[] | null> {
  const { data, error } = await supabase.rpc("admin_list_app_users");
  if (error) {
    console.error("[access] admin_list_app_users failed:", error);
    return null;
  }
  const rows = (data ?? []) as {
    user_id: string;
    email: string | null;
    display_name: string | null;
    is_admin: boolean;
    external: boolean;
    created_at: string;
    last_sign_in_at: string | null;
  }[];
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    isAdmin: r.is_admin === true,
    external: r.external === true,
    createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at,
  }));
}
