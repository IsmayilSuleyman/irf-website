import { NextResponse } from "next/server";
import { runMomentumWeekSnapshot } from "@/lib/momentumSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manually (or externally) trigger this week's momentum snapshot. The normal
 * path is the Baku-Monday branch of the daily /api/record-price cron — both
 * Vercel cron slots are taken, so this route exists for backfilling a missed
 * Monday and for ?dryRun=1 inspection without waiting for the schedule.
 * Same Bearer guard as the other cron routes; the RPC's shared secret is the
 * real write authority.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  try {
    const result = await runMomentumWeekSnapshot({ dryRun });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: String(err) }, { status: 500 });
  }
}
