import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Self-service Google linking for an EXISTING, approved login — shared by
 * the dashboard/bank banners and the small status card on /bank. Supabase's
 * own identity linking does the work (Authentication → Settings → "Allow
 * manual linking" must be ON); the pin_full_name trigger keeps the name, so
 * the Google profile cannot rename the holder. Once linked, "Google ilə
 * daxil ol" (and One Tap) resolve straight to this account: no /register,
 * no admin step.
 */
export type GoogleLinkStatus = "linked" | "error" | "exists" | null;

export const GOOGLE_LINK_TEXT: Record<Exclude<GoogleLinkStatus, null>, string> = {
  linked: "Google hesabı bağlandı — bundan sonra Google ilə birbaşa daxil ola bilərsiniz.",
  error: "Google hesabı bağlanmadı. Yenidən cəhd edin.",
  exists: "Bu Google hesabı artıq başqa girişə bağlıdır.",
};

export const GOOGLE_LINK_DISABLED =
  "Google bağlama hələ aktiv deyil — admin Supabase-də manual linking-i açmalıdır.";

/** The `?google=` outcome param a page receives back from /auth/callback. */
export function parseGoogleLinkStatus(raw: unknown): GoogleLinkStatus {
  return raw === "linked" || raw === "error" || raw === "exists" ? raw : null;
}

/**
 * Kick off the linking round-trip. Resolves to an error message, or null
 * when the browser is already on its way to Google. `returnTo` is the page
 * to land on afterwards; the callback appends ?google=linked (or the error).
 */
export async function startGoogleLink(returnTo: string): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return GOOGLE_LINK_TEXT.error;
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", `${returnTo}?google=linked`);
  callback.searchParams.set("link", "1");
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });
  if (!error) return null;
  return /manual linking/i.test(error.message)
    ? GOOGLE_LINK_DISABLED
    : GOOGLE_LINK_TEXT.error;
}
