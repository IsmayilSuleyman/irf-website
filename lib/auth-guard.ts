import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import { getAccessScope, type AccessScope } from "@/lib/access";

export async function requireUser(loginRedirect?: string): Promise<User> {
  const { reason, user } = await getSupabaseServerUser();

  if (reason === "missing_config") {
    redirect("/welcome?setup=supabase");
  }

  if (reason === "error" || !user) {
    redirect(loginRedirect ? `/login?next=${loginRedirect}` : "/login");
  }

  return user;
}

/** requireUser plus the caller's access scope (see lib/access.ts). */
export async function requireUserWithScope(
  loginRedirect?: string,
): Promise<{ user: User; scope: AccessScope }> {
  const user = await requireUser(loginRedirect);
  const scope = await getAccessScope(await createSupabaseServerClient());
  return { user, scope };
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
