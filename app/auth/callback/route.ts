import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/nextPath";

/**
 * OAuth landing: Supabase sends the browser here with a one-time `code`
 * after Google sign-in. Exchanging it writes the session cookies, then the
 * user continues to the validated `next` path (external members are bounced
 * from the family pages to /bank by requireFamilyUser, so /portal is a
 * fine default for everyone).
 *
 * Deliberately NOT in the middleware matcher: this route authenticates
 * itself through the server client, and widening the matcher is what caused
 * the deploy-time logout stampedes (see middleware.ts).
 *
 * Failure modes land on /login with an Azerbaijani message:
 *   ?error=not_invited — Google account whose e-mail has no pre-created
 *                        user (sign-ups are off, so GoTrue refuses it)
 *   ?error=google      — anything else (cancelled consent, stale code, …)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const base = publicOrigin(request);
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");
  const providerErrorCode = url.searchParams.get("error_code");

  const fail = (kind: "google" | "not_invited") =>
    NextResponse.redirect(`${base}/login?error=${kind}`);

  if (providerError || !code) {
    if (providerErrorCode === "signup_disabled") return fail("not_invited");
    console.error("[auth/callback] provider returned no code:", {
      error: providerError,
      code: providerErrorCode,
      description: url.searchParams.get("error_description"),
    });
    return fail("google");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(`${base}/welcome?setup=supabase`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error);
    return fail(error.code === "signup_disabled" ? "not_invited" : "google");
  }

  return NextResponse.redirect(`${base}${next}`);
}

/**
 * The origin the BROWSER sees. Behind Vercel's proxy request.nextUrl.origin
 * can be the internal host, so prefer the forwarded header in production.
 */
function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && process.env.NODE_ENV === "production") {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}
