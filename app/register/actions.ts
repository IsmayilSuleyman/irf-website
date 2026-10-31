"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyAccess, type AccessStatus } from "@/lib/access";
import { sendPushAll, type StoredSub } from "@/lib/push";

export type SubmitRegistrationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Ad + Soyad from /register. The RPC stores the request and rings
 * İsmayıl's bell; the push goes out from here (the admin's subscription
 * secrets are only reachable through the cron-secret-gated
 * admin_push_context, never from a user-callable surface), and only for a
 * NEW request — a typo fix must not ping twice.
 */
export async function submitRegistration(
  firstName: string,
  lastName: string,
): Promise<SubmitRegistrationResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  }
  const { data, error } = await supabase.rpc("submit_registration", {
    p_first_name: firstName,
    p_last_name: lastName,
  });
  if (error) {
    console.error("[register] submit_registration failed:", error);
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Sessiya bitib — yenidən daxil olun."
          : error.message || "Sorğu göndərilmədi.",
    };
  }

  if (data === true) {
    const secret = process.env.PAYMENT_REMINDER_SECRET;
    if (secret) {
      const pushRes = await supabase.rpc("admin_push_context", {
        p_secret: secret,
      });
      const pushCtx = (pushRes.data ?? {}) as {
        unread?: number;
        subs?: StoredSub[];
      };
      if (!pushRes.error && (pushCtx.subs ?? []).length > 0) {
        await sendPushAll(pushCtx.subs ?? [], {
          title: "Yeni qeydiyyat sorğusu",
          body: `${firstName.trim()} ${lastName.trim()} giriş üçün təsdiq gözləyir.`,
          url: "/bank",
          unread: pushCtx.unread,
          tag: "irf-registration",
        });
      }
    }
  }

  revalidatePath("/register");
  return { ok: true };
}

export type RegistrationCheck =
  | { status: AccessStatus }
  /** The session no longer resolves to a user: signed out, or the placeholder
   *  login was linked to an existing profile (and so deleted) by İsmayıl. */
  | { status: "gone" };

/** Polled by the pending view until İsmayıl decides. */
export async function checkRegistration(): Promise<RegistrationCheck> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "gone" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "gone" };
  const access = await getMyAccess(supabase);
  return { status: access.status };
}
