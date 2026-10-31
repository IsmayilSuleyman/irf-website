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
 * (mirrors `admin_users`); nothing client-writable takes part.
 */
export type AccessScope = "family" | "external";

/**
 * Whether the login is allowed in at all. "approved" means the auth user
 * has a full_name — the one thing every holder lookup keys on, and which
 * only İsmayıl (postgres) can write since the pin_full_name trigger. A
 * fresh Google sign-in has no name: it is "unregistered" until the member
 * fills in Ad + Soyad on /register, then "pending" until İsmayıl approves
 * it in the cabinet (or links it to an existing profile, after which this
 * placeholder login no longer exists).
 */
export type AccessStatus = "approved" | "pending" | "unregistered";

export type MyAccess = {
  status: AccessStatus;
  scope: AccessScope;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

const OPEN: MyAccess = {
  status: "approved",
  scope: "family",
  email: null,
  firstName: null,
  lastName: null,
};

/**
 * One definer RPC (`my_access`) answers both gates. Fails OPEN to
 * approved/family: a transient RPC error must not strand the family on
 * /register or /bank, and the migration may not be applied yet on a fresh
 * branch. The pages a pending or external member is kept off are family
 * data, not secrets — the redirect is a courtesy wall; the rules with money
 * behind them (share cap, holder identity = full_name) live in the database,
 * and a nameless login matches no holder anywhere.
 */
export async function getMyAccess(
  supabase: SupabaseClient | null,
): Promise<MyAccess> {
  if (!supabase) return OPEN;
  const { data, error } = await supabase.rpc("my_access");
  if (error) {
    console.error("[access] my_access failed:", error);
    return OPEN;
  }
  const row = (data ?? {}) as {
    status?: string;
    external?: boolean;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
  const status: AccessStatus =
    row.status === "pending" || row.status === "unregistered"
      ? row.status
      : "approved";
  return {
    status,
    scope: row.external === true ? "external" : "family",
    email: row.email ?? null,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
  };
}

/** Scope only — see getMyAccess for the failure policy. */
export async function getAccessScope(
  supabase: SupabaseClient | null,
): Promise<AccessScope> {
  return (await getMyAccess(supabase)).scope;
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

export type Registration = {
  userId: string;
  email: string | null;
  firstName: string;
  lastName: string;
  requestedAt: string;
  /** "google", "email", or "email, google" — how the placeholder signed in. */
  providers: string | null;
};

/** Admin only — every pending /register request, oldest first. */
export async function listRegistrations(
  supabase: SupabaseClient,
): Promise<Registration[]> {
  const { data, error } = await supabase.rpc("admin_list_registrations");
  if (error) {
    console.error("[access] admin_list_registrations failed:", error);
    return [];
  }
  const rows = (data ?? []) as {
    user_id: string;
    email: string | null;
    first_name: string;
    last_name: string;
    requested_at: string;
    providers: string | null;
  }[];
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    requestedAt: r.requested_at,
    providers: r.providers,
  }));
}
