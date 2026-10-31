"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

/**
 * Google Identity Services on our own page: Google's "Continue with Google"
 * button and, optionally, the One Tap prompt. Both hand back an ID token
 * that the parent passes to Supabase (signInWithIdToken / linkIdentity).
 *
 * Why not the redirect flow (signInWithOAuth)? That one sends the browser
 * to Supabase first, so Google's consent screen names
 * "hcuchfdcanleifofywcn.supabase.co" as the app. With GIS the request comes
 * from this origin, so the screen names the site instead — and no page
 * round-trip is needed. The redirect flow stays as the fallback when
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.
 *
 * Nonce rule from the Supabase docs: Google receives the SHA-256 hex of the
 * nonce, Supabase the raw one. auto_select makes One Tap sign a returning
 * Google user in without a click.
 */
export type GoogleCredential = { token: string; nonce: string };

type GoogleId = {
  initialize: (config: Record<string, unknown>) => void;
  prompt: () => void;
  cancel: () => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function GoogleIdentity({
  clientId,
  onCredential,
  oneTap = false,
  text = "continue_with",
}: {
  clientId: string;
  onCredential: (cred: GoogleCredential) => void;
  /** Also show the One Tap prompt (login page only). */
  oneTap?: boolean;
  /** Google button wording: "Continue with Google" / "Sign in with Google". */
  text?: "continue_with" | "signin_with";
}) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  const start = async () => {
    const id = window.google?.accounts?.id;
    const parent = buttonRef.current;
    if (!id || !parent || startedRef.current) return;
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
      auto_select: oneTap,
      cancel_on_tap_outside: false,
      itp_support: true,
      use_fedcm_for_prompt: true,
    });
    id.renderButton(parent, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text,
      logo_alignment: "left",
      locale: "az",
      width: Math.min(400, Math.max(200, Math.round(parent.clientWidth || 300))),
    });
    if (oneTap) id.prompt();
  };

  useEffect(() => {
    // The script may already be cached and executed before this effect.
    void start();
    return () => {
      if (oneTap) window.google?.accounts?.id?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => void start()}
      />
      <div ref={buttonRef} className="flex min-h-[44px] w-full justify-center" />
    </>
  );
}
