"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  GOOGLE_LINK_TEXT,
  linkGoogleWithIdToken,
  startGoogleLink,
  type GoogleLinkStatus,
} from "@/lib/googleLink";
import { GOOGLE_CLIENT_ID, GoogleIdentity } from "@/components/GoogleIdentity";

/**
 * Status card on /bank for an approved login: which Google account is
 * linked, with unlink. Linking itself is offered by GoogleLinkBanner at the
 * top of /dashboard and /bank (see lib/googleLink.ts for the mechanics);
 * this card still carries a link button for the "Hesab tapılmadı" branch,
 * where no banner is shown.
 */
export type { GoogleLinkStatus };

export function GoogleLinkCard({
  googleEmail,
  canUnlink,
  status,
}: {
  /** E-mail of the linked Google identity, or null when none is linked. */
  googleEmail: string | null;
  /** Supabase refuses to unlink the last identity; false when Google is the only one. */
  canUnlink: boolean;
  /** Outcome of the last round-trip, from ?google= on the URL. */
  status: GoogleLinkStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    status ? GOOGLE_LINK_TEXT[status] : null,
  );
  const [failed, setFailed] = useState(status != null && status !== "linked");

  const onLink = async () => {
    setBusy(true);
    setFailed(false);
    setMessage(null);
    const error = await startGoogleLink("/bank");
    if (error) {
      setBusy(false);
      setFailed(true);
      setMessage(error);
    }
    // Otherwise the browser is on its way to Google.
  };

  const onIdToken = async (cred: { token: string; nonce: string }) => {
    setBusy(true);
    setFailed(false);
    setMessage(null);
    const error = await linkGoogleWithIdToken(cred);
    setBusy(false);
    if (error) {
      setFailed(true);
      setMessage(error);
      return;
    }
    setMessage(GOOGLE_LINK_TEXT.linked);
    router.refresh();
  };

  const onUnlink = async () => {
    if (!window.confirm(`${googleEmail} Google hesabı bu girişdən ayrılsın? Google ilə giriş bağlanacaq; şifrə ilə giriş qalır.`)) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setFailed(false);
    setMessage(null);
    const { data, error: listError } = await supabase.auth.getUserIdentities();
    const google = data?.identities.find((i) => i.provider === "google");
    const error = listError ?? (google ? (await supabase.auth.unlinkIdentity(google)).error : null);
    setBusy(false);
    if (error || !google) {
      setFailed(true);
      setMessage("Google hesabı ayrılmadı. Yenidən cəhd edin.");
      return;
    }
    setMessage("Google hesabı ayrıldı.");
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            Google ilə giriş
          </p>
          <p className="mt-1 text-sm text-ink dark:text-white/90">
            {googleEmail ? (
              <>
                Bağlıdır:{" "}
                <span className="font-medium">{googleEmail}</span>
              </>
            ) : (
              "Google hesabınızı bağlayın — sonra şifrəsiz, bir kliklə daxil olarsınız."
            )}
          </p>
        </div>
        {googleEmail ? (
          canUnlink ? (
            <button
              type="button"
              disabled={busy}
              onClick={onUnlink}
              className="shrink-0 rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/60 dark:text-white/70 transition hover:border-brand-red/40 hover:text-brand-red disabled:opacity-50"
            >
              {busy ? "…" : "Ayır"}
            </button>
          ) : null
        ) : GOOGLE_CLIENT_ID ? (
          <div className={`w-[240px] max-w-full ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <GoogleIdentity clientId={GOOGLE_CLIENT_ID} onCredential={onIdToken} />
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onLink}
            className="shrink-0 rounded-lg bg-brand-green px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-brand-green-soft disabled:opacity-50"
          >
            {busy ? "Google-a yönləndirilir…" : "Google hesabını bağla"}
          </button>
        )}
      </div>
      {message ? (
        <p
          className={`mt-3 text-xs ${
            failed
              ? "text-brand-red dark:text-red-400"
              : "text-brand-green dark:text-emerald-400"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
