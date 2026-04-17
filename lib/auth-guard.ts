import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerUser } from "@/lib/supabase/server";

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
