import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnostic only — reports whether the VAPID env is present in the deployed
// runtime. Returns booleans only, never the key values. If
// vapidPrivateKeySet is false, the server can't sign Web Push (so app-triggered
// pushes silently no-op) until VAPID_PRIVATE_KEY is set in Vercel + redeployed.
export async function GET() {
  return NextResponse.json({
    vapidPrivateKeySet: Boolean(process.env.VAPID_PRIVATE_KEY),
    vapidPublicKeyEnvSet: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    vapidSubjectSet: Boolean(process.env.VAPID_SUBJECT),
  });
}
