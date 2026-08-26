"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Server actions for the personal debt reminders card. Every RPC is
// SECURITY DEFINER with an auth.uid() gate and touches only the caller's
// own rows — nothing here needs an admin check.

export type PersonalDebtActionResult =
  | { ok: true }
  | { ok: false; error: string };

const FAIL = (msg: string): PersonalDebtActionResult => ({
  ok: false,
  error: msg,
});

export async function savePersonalDebt(input: {
  id?: string | null;
  title: string;
  amountAzn?: number | null;
  dueDate: string; // YYYY-MM-DD
  note?: string | null;
  remindDaysBefore?: number;
  recurringMonthly?: boolean;
  /** 2-120 = finite monthly installment plan; amount becomes per-taksit. */
  installments?: number | null;
}): Promise<PersonalDebtActionResult> {
  const title = input.title?.trim() ?? "";
  if (title.length === 0 || title.length > 80) {
    return FAIL("Ad 1-80 simvol olmalıdır.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? "")) {
    return FAIL("Tarix düzgün deyil.");
  }
  const amount =
    input.amountAzn == null || !Number.isFinite(input.amountAzn)
      ? null
      : input.amountAzn;
  if (amount != null && (amount <= 0 || amount > 1_000_000)) {
    return FAIL("Məbləğ düzgün deyil.");
  }
  const installments =
    input.installments == null || !Number.isFinite(input.installments)
      ? null
      : Math.round(input.installments);
  if (installments != null && (installments < 2 || installments > 120)) {
    return FAIL("Taksit sayı 2-120 aralığında olmalıdır.");
  }
  if (installments != null && amount == null) {
    return FAIL("Taksit planı üçün aylıq məbləğ tələb olunur.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return FAIL("Supabase konfiqurasiya olunmayıb.");
  const { error } = await supabase.rpc("save_personal_debt", {
    p_title: title,
    p_due_date: input.dueDate,
    p_amount_azn: amount,
    p_note: input.note?.trim() || null,
    p_remind_days: Math.min(Math.max(Math.round(input.remindDaysBefore ?? 3), 0), 30),
    p_recurring: Boolean(input.recurringMonthly),
    p_installments: installments,
    p_id: input.id || null,
  });
  if (error) {
    console.error("[personal-debts] save failed:", error);
    return FAIL("Yadda saxlanmadı.");
  }
  revalidatePath("/bank");
  return { ok: true };
}

export async function setPersonalDebtPaid(
  id: string,
  paid: boolean,
): Promise<PersonalDebtActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return FAIL("Supabase konfiqurasiya olunmayıb.");
  const { error } = await supabase.rpc("set_personal_debt_paid", {
    p_id: id,
    p_paid: paid,
  });
  if (error) {
    console.error("[personal-debts] set-paid failed:", error);
    return FAIL("Əməliyyat alınmadı.");
  }
  revalidatePath("/bank");
  return { ok: true };
}

export async function deletePersonalDebt(
  id: string,
): Promise<PersonalDebtActionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return FAIL("Supabase konfiqurasiya olunmayıb.");
  const { error } = await supabase.rpc("delete_personal_debt", { p_id: id });
  if (error) {
    console.error("[personal-debts] delete failed:", error);
    return FAIL("Silinmədi.");
  }
  revalidatePath("/bank");
  return { ok: true };
}
