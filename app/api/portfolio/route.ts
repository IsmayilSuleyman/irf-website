import { NextResponse } from "next/server";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getFundData, getHolderByName } from "@/lib/sheets";

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
  const { reason, user } = await getSupabaseServerUser();

  if (reason === "missing_config") {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 503 },
    );
  }

  if (reason === "error") {
    return NextResponse.json(
      { error: "Authentication service is temporarily unavailable." },
      { status: 503 },
    );
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = displayNameOf(user.user_metadata);
  const holder = await getHolderByName(name);
  if (!holder) {
    return NextResponse.json(
      { error: "No holder record linked to this account." },
      { status: 404 },
    );
  }

  const fund = await getFundData();
  return NextResponse.json({ holder, fund });
}
