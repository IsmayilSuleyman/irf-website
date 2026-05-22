import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";
import { getFundData } from "@/lib/sheets";
import { buildFundSyncPayload } from "@/lib/holdings";

export const runtime = "nodejs";

// Admin-only: read the Google Sheet and push trusted config + opening balances
// into Supabase. Authorization is enforced inside the sync_fund_state RPC.
export async function POST() {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  let fund;
  try {
    fund = await getFundData();
  } catch (err) {
    return NextResponse.json(
      { error: `Google Sheet read failed: ${String(err)}` },
      { status: 502 },
    );
  }

  const payload = buildFundSyncPayload(fund);
  const { data, error } = await ctx.supabase.rpc("sync_fund_state", { p_payload: payload });
  if (error) return rpcErrorResponse(error);
  return NextResponse.json({ result: data, synced: payload.opening_balances.length });
}
