import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBankAccountByName } from "@/lib/bank";

export const runtime = "nodejs";

function displayNameOf(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.display_name as string) ||
    null
  );
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = displayNameOf(user.user_metadata);
  const account = await getBankAccountByName(name);

  if (!account) {
    return NextResponse.json(
      { error: "No bank account record linked to this account." },
      { status: 404 },
    );
  }

  return NextResponse.json({ account });
}
