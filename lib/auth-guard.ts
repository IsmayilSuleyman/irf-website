import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import { getMyAccess, type AccessScope, type MyAccess } from "@/lib/access";

/** Signed-in user, or a redirect to /login. No approval check — /register
 *  and the sign-out paths need exactly this. */
export async function requireSignedIn(loginRedirect?: string): Promise<User> {
  const { reason, user } = await getSupabaseServerUser();

  if (reason === "missing_config") {
    redirect("/welcome?setup=supabase");
  }

  if (reason === "error" || !user) {
    redirect(loginRedirect ? `/login?next=${loginRedirect}` : "/login");
  }

  return user;
}

/**
 * Signed in AND approved. A login without a name (a fresh Google sign-in,
 * or one still waiting for İsmayıl) is sent to /register; every app page
 * goes through here, so that is the only page such a login can reach.
 */
export async function requireUserWithAccess(
  loginRedirect?: string,
): Promise<{ user: User; access: MyAccess }> {
  const user = await requireSignedIn(loginRedirect);
  const access = await getMyAccess(await createSupabaseServerClient());
  if (access.status !== "approved") {
    redirect("/register");
  }
  return { user, access };
}

export async function requireUser(loginRedirect?: string): Promise<User> {
  return (await requireUserWithAccess(loginRedirect)).user;
}

/** requireUser plus the caller's access scope (see lib/access.ts). */
export async function requireUserWithScope(
  loginRedirect?: string,
): Promise<{ user: User; scope: AccessScope }> {
  const { user, access } = await requireUserWithAccess(loginRedirect);
  return { user, scope: access.scope };
}

/**
 * requireUser for the family-only pages (/dashboard, /portal): an external
 * member is sent to /bank, the page that is his.
 */
export async function requireFamilyUser(loginRedirect?: string): Promise<User> {
  const { user, scope } = await requireUserWithScope(loginRedirect);
  if (scope === "external") {
    redirect("/bank");
  }
  return user;
}
