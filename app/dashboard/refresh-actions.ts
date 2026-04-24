"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export async function revalidateSheetData(): Promise<{ ok: boolean }> {
  const { user } = await getSupabaseServerUser();
  if (!user) return { ok: false };

  revalidateTag("sheet");
  revalidatePath("/dashboard");
  return { ok: true };
}
