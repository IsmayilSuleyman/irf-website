"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

/**
 * Google One Tap on the login page. Once someone has signed in with Google
 * here, Google remembers that for this site and, with `auto_select`, signs
 * them back in on the next visit without a click — the "automatic login"
 * for Google users. Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID (the same web client
 * as the Supabase Google provider) and the site origin among the client's
 * "Authorized JavaScript origins"; without the env var this renders nothing
 * and the ordinary "Google ilə daxil ol" button is the only path.
 *
 * The ID token goes to Supabase via signInWithIdToken (parent). Nonce rule
 * from the Supabase docs: Google receives the SHA-256 hex of the nonce, Supabase
 * the raw one.
 */
export type OneTapCredential = { token: string; nonce: string };

type GoogleId = {
  initialize: (config: Record<string, unknown>) => void;
  prompt: () => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function GoogleOneTap({
  clientId,
  onCredential,
}: {
  clientId: string;
  onCredential: (cred: OneTapCredential) => void;
}) {
  const nonceRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  const start = async () => {
    const id = window.google?.accounts?.id;
    if (!id || startedRef.current) return;
    startedRef.current = true;
    const nonce = crypto.randomUUID();
    nonceRef.current = nonce;
    id.initialize({
      client_id: clientId,
      callback: (res: { credential?: string }) => {
        if (res.credential && nonceRef.current) {
          onCredentialRef.current({ token: res.credential, nonce: nonceRef.current });
        }
      },
      nonce: await sha256Hex(nonce),
      auto_select: true,
      cancel_on_tap_outside: false,
      itp_support: true,
      use_fedcm_for_prompt: true,
    });
    id.prompt();
  };

  useEffect(() => {
    // The script may already be cached and executed before this effect.
    void start();
    return () => {
      window.google?.accounts?.id?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={() => void start()}
    />
  );
}
