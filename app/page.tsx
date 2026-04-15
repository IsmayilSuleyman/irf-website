import { redirect } from "next/navigation";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export default async function Home() {
  const { reason, user } = await getSupabaseServerUser();

  if (reason === "missing_config") {
    redirect("/welcome?setup=supabase");
  }

  if (reason === "error") {
    redirect("/welcome");
  }

  redirect(user ? "/portal" : "/welcome");
}
