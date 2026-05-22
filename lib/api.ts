import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthedContext = { supabase: SupabaseClient; user: User };

/** Returns an authenticated Supabase client + user, or a NextResponse to return. */
export async function getAuthedContext(): Promise<AuthedContext | NextResponse> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 503 },
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { supabase, user };
}

/** Maps a Postgres/PostgREST error to an HTTP response (42501 = not authorized). */
export function rpcErrorResponse(error: { message: string; code?: string }) {
  const status = error.code === "42501" ? 403 : 400;
  return NextResponse.json({ error: error.message }, { status });
}
