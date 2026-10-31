"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RegistrationActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function failure(error: { code?: string; message: string }): RegistrationActionResult {
  return {
    ok: false,
    error:
      error.code === "42501"
        ? "Bu əməliyyat üçün icazəniz yoxdur."
        : error.message || "Əməliyyat alınmadı.",
  };
}

/** Admin: confirm a /register request as a NEW account with the given name. */
export async function approveRegistration(
  userId: string,
  fullName: string,
  external: boolean,
): Promise<RegistrationActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  const { data, error } = await supabase.rpc("admin_approve_registration", {
    p_user_id: userId,
    p_full_name: fullName,
    p_external: external,
  });
  if (error) {
    console.error("[registrations] approve failed:", error);
    return failure(error);
  }
  const res = (data ?? {}) as { full_name?: string; external?: boolean };
  revalidatePath("/bank");
  return {
    ok: true,
    message: `${res.full_name ?? fullName} təsdiqləndi${res.external ? " (kənar üzv)" : ""}.`,
  };
}

/** Admin: attach the request's Google identity to an EXISTING profile. */
export async function linkRegistration(
  userId: string,
  targetUserId: string,
): Promise<RegistrationActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  const { data, error } = await supabase.rpc("admin_link_registration", {
    p_user_id: userId,
    p_target_user_id: targetUserId,
  });
  if (error) {
    console.error("[registrations] link failed:", error);
    return failure(error);
  }
  const res = (data ?? {}) as { target_name?: string };
  revalidatePath("/bank");
  return {
    ok: true,
    message: `Google girişi ${res.target_name ?? "mövcud profilə"} bağlandı — üzv Google ilə yenidən daxil olmalıdır.`,
  };
}

/** Admin: delete the placeholder login. */
export async function rejectRegistration(
  userId: string,
): Promise<RegistrationActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase konfiqurasiya olunmayıb." };
  const { error } = await supabase.rpc("admin_reject_registration", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[registrations] reject failed:", error);
    return failure(error);
  }
  revalidatePath("/bank");
  return { ok: true, message: "Sorğu rədd edildi, giriş silindi." };
}
