import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/bank") ||
    pathname.startsWith("/bonds") ||
    pathname.startsWith("/market") ||
    pathname.startsWith("/portal");
  const isAuthPage = pathname.startsWith("/login");
  const config = getSupabaseConfig();

  if (!config) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/welcome";
      url.search = "";
      url.searchParams.set("setup", "supabase");
      return NextResponse.redirect(url);
    }

    return response;
  }

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // A failed getUser() is NOT always "signed out". Deploys used to log every
  // user out through exactly this hole: all tabs reload at once, dozens of
  // concurrent middleware runs race to refresh the same rotated refresh
  // token, and the losers surface transient errors (or worse, trip
  // Supabase's reuse detection). Only a DEFINITIVE auth answer — no session
  // cookie at all, or the auth server rejecting the token with a 4xx — may
  // bounce the user to /login. Transient failures (network, 5xx, cold
  // starts) pass through; the page-level requireUser retries moments later.
  let user = null;
  let sessionInvalid = false;
  try {
    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (error) {
      const status = (error as { status?: number }).status ?? 0;
      if (error.name === "AuthSessionMissingError") {
        sessionInvalid = true;
      } else if (status >= 400 && status < 500) {
        sessionInvalid = true;
        console.error("Middleware auth rejected the session:", error);
      } else {
        console.error("Middleware auth.getUser() failed transiently:", error);
      }
    } else {
      user = data.user;
    }
  } catch (error) {
    console.error("Middleware auth bootstrap failed:", error);
  }

  if (isProtected && !user && sessionInvalid) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    const nextPath = request.nextUrl.searchParams.get("next");
    url.pathname =
      nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
        ? nextPath
        : "/portal";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

// Run only where a session decision is actually needed: the gated app pages,
// /login (for the signed-in bounce-back), and the public pages whose headers
// change with auth state. The old matcher caught EVERYTHING except static
// assets — every /api call, manifest, icon and prefetch ran a token refresh,
// so one deploy-triggered reload burst meant dozens of concurrent refreshes
// racing the same rotated refresh token. Supabase reads that as token theft
// and revokes the whole family — the "everyone is logged out after each
// update" bug. Cutting the surface to real page navigations removes the
// stampede; /api routes authenticate themselves via their own server client.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/bank/:path*",
    "/bonds/:path*",
    "/market/:path*",
    "/portal/:path*",
    "/login",
    "/",
    "/welcome",
    "/ismayilbank",
  ],
};
