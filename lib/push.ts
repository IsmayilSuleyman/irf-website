import webpush from "web-push";

export type StoredSub = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  unread?: number;
  tag?: string;
};

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    "BPpa36JzM4PgP4PBBvCukwt8QiyHuJ8GIar2h43jwMNEcPafVYLEJtaQmT2LG4fFbVLNGbTgc1dDmyyE5UCutBg";
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:irf.ismayilsuleyman@gmail.com";
  // Only the private key is secret; without it we can't sign, so bail.
  if (!priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

// Send one Web Push message. Returns gone=true if the subscription is expired
// (404/410) so the caller can prune it.
export async function sendPush(
  sub: StoredSub,
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  if (!ensureConfigured()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      // High urgency so the push service delivers immediately even while the
      // device is dozing (Android/Samsung otherwise batch normal pushes until
      // the app is foregrounded). TTL: hold up to a day if the device is off.
      { urgency: "high", TTL: 24 * 60 * 60 },
    );
    return { ok: true, gone: false };
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    return { ok: false, gone: status === 404 || status === 410 };
  }
}

// Fan a payload out to all of a user's subscriptions.
export async function sendPushAll(
  subs: StoredSub[],
  payload: PushPayload,
): Promise<void> {
  await Promise.all(subs.map((s) => sendPush(s, payload).catch(() => undefined)));
}
