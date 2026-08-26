import type { SupabaseClient } from "@supabase/supabase-js";

// Personal debt reminders — debts OUTSIDE İsmayılBank (utilities, cards,
// money owed to people). Own-rows RLS; all writes go through the definer
// RPCs (save/set-paid/delete), and the daily payment-reminders cron turns
// due entries into bell + push notifications via
// sync_personal_debt_reminders.

export type PersonalDebt = {
  id: string;
  title: string;
  amountAzn: number | null;
  dueDate: string; // YYYY-MM-DD
  note: string | null;
  remindDaysBefore: number;
  recurringMonthly: boolean;
  paidAt: string | null;
};

/** The caller's own debts: open ones first (soonest due on top), settled
 *  one-offs after. Null when the table is unreachable. */
export async function getMyPersonalDebts(
  supabase: SupabaseClient,
): Promise<PersonalDebt[] | null> {
  const { data, error } = await supabase
    .from("personal_debts")
    .select(
      "id, title, amount_azn, due_date, note, remind_days_before, recurring_monthly, paid_at",
    )
    .order("due_date", { ascending: true })
    .limit(100);
  if (error) {
    console.error("[personal-debts] fetch failed:", error);
    return null;
  }
  const rows = (data ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    amountAzn: r.amount_azn == null ? null : Number(r.amount_azn),
    dueDate: String(r.due_date ?? ""),
    note: r.note == null ? null : String(r.note),
    remindDaysBefore: Number(r.remind_days_before ?? 3),
    recurringMonthly: Boolean(r.recurring_monthly),
    paidAt: r.paid_at == null ? null : String(r.paid_at),
  }));
  return [...rows.filter((r) => !r.paidAt), ...rows.filter((r) => r.paidAt)];
}
