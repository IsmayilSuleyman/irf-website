"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GOOGLE_LINK_TEXT,
  linkGoogleWithIdToken,
  startGoogleLink,
  type GoogleLinkStatus,
} from "@/lib/googleLink";
import { GOOGLE_CLIENT_ID, GoogleIdentity } from "@/components/GoogleIdentity";

// "Link your Google account" banner, same shape as the İsmayılBank credit
// offer: shown at the top of /dashboard and /bank to every approved login
// that has no Google identity yet. "Sonra" hides it on this device
// (localStorage, best effort); it is back as soon as the account still has
// no Google identity on another device, and gone for good once linked.
//
// With a Google client ID the button is Google's own (ID token, no
// redirect, consent screen names this site); otherwise the redirect flow.

const DISMISS_KEY = "irf-google-link-dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function GoogleLinkBanner({
  returnTo,
  status,
  tone = "fund",
}: {
  /** Page to come back to after Google (e.g. "/dashboard"). */
  returnTo: string;
  /** Outcome of the last round-trip, from ?google= on the URL. */
  status: GoogleLinkStatus;
  /** Fund green on /dashboard, bank blue on /bank. */
  tone?: "fund" | "bank";
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(
    status && status !== "linked" ? GOOGLE_LINK_TEXT[status] : null,
  );

  // Dismissal is per-browser, so decide after hydration; an error result
  // always shows, whatever was dismissed before.
  useEffect(() => {
    setHidden(error == null && readDismissed());
  }, [error]);

  if (hidden) return null;

  const onRedirectLink = async () => {
    setBusy(true);
    setError(null);
    const message = await startGoogleLink(returnTo);
    if (message) {
      setBusy(false);
      setError(message);
    }
  };

  const onIdToken = async (cred: { token: string; nonce: string }) => {
    setBusy(true);
    setError(null);
    const message = await linkGoogleWithIdToken(cred);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    setDone(true);
    router.refresh();
  };

  const onLater = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private window or blocked storage: the banner simply comes back.
    }
    setHidden(true);
  };

  const gradient =
    tone === "bank"
      ? "border-bank-blue/30 dark:border-blue-400/30 bg-gradient-to-br from-bank-blue to-bank-blue-deep"
      : "border-brand-green/30 dark:border-emerald-400/30 bg-gradient-to-br from-brand-green to-[#1f6b45]";
  const primaryText = tone === "bank" ? "text-bank-blue-deep" : "text-brand-green";

  return (
    <section
      aria-label="Google hesabını bağla"
      className={`relative overflow-hidden rounded-2xl border p-5 text-white sm:p-6 ${gradient}`}
    >
      <div
        aria-hidden
        className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
            Google ilə giriş
          </p>
          <h2 className="mt-2 text-[clamp(1.15rem,2.6vw,1.45rem)] font-black tracking-[-0.03em]">
            {done
              ? "Google hesabı bağlandı"
              : "Google hesabınızı bağlayın — bir kliklə daxil olun"}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
            {done
              ? GOOGLE_LINK_TEXT.linked
              : "Bir dəfə bağlayın; sonra şifrəsiz, Google ilə birbaşa bu hesaba girərsiniz. Adınız və tarixçəniz olduğu kimi qalır."}
          </p>
          {error ? (
            <p className="mt-2 text-xs font-medium text-amber-200">{error}</p>
          ) : null}
        </div>
        {done ? null : (
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {GOOGLE_CLIENT_ID ? (
              <div className={`w-[260px] max-w-full ${busy ? "pointer-events-none opacity-60" : ""}`}>
                <GoogleIdentity clientId={GOOGLE_CLIENT_ID} onCredential={onIdToken} />
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onRedirectLink}
                className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${primaryText} shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0`}
              >
                <GoogleMark />
                {busy ? "Google-a yönləndirilir…" : "Google hesabını bağla"}
              </button>
            )}
            <button
              type="button"
              onClick={onLater}
              className="text-[11px] font-medium text-white/70 transition hover:text-white"
            >
              Sonra
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3a7.2 7.2 0 0 1-10.73-3.78H1.34v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.34 14.31a7.2 7.2 0 0 1 0-4.62V6.6H1.34a12 12 0 0 0 0 10.8l4-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.34 6.6l4 3.09A7.17 7.17 0 0 1 12 4.75Z" />
    </svg>
  );
}
