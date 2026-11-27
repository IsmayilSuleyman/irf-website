import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  const cookieStore = await cookies();
  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware will refresh.
          }
        },
      },
    },
  );
}

export type SupabaseServerUserResult =
  | {
      reason: "configured";
      user: User | null;
    }
  | {
      reason: "error" | "missing_config";
      user: null;
    };

export async function getSupabaseServerUser(): Promise<SupabaseServerUserResult> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { reason: "missing_config", user: null };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (error.name !== "AuthSessionMissingError") {
        console.error("Supabase auth.getUser() failed:", error);
      }
      return { reason: "error", user: null };
    }

    return { reason: "configured", user };
  } catch (error) {
    console.error("Supabase auth bootstrap failed:", error);
    return { reason: "error", user: null };
  }
}

/**
 * getSupabaseServerUser, answered ONCE per page render: the auth guard and
 * the page's own loaders (getMarketData, getBondMarketData) used to ask
 * GoTrue separately — one sequential network round trip each, on top of
 * the middleware's own check. React's request-scoped cache() shares the
 * first answer. Pages only: server actions keep the uncached call, so an
 * action never reads a user from before its own auth change.
 */
export const getRequestUser = cache(getSupabaseServerUser);
