"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/nextPath";

/** Messages for the `?error=` the OAuth callback (app/auth/callback) sets. */
const CALLBACK_ERRORS: Record<string, string> = {
  not_invited:
    "Bu Google hesabı üçün giriş açılmayıb. Giriş yalnız əvvəlcədən qeydə alınmış e-poçtlarla mümkündür.",
  google: "Google ilə giriş alınmadı. Yenidən cəhd edin.",
};

export function LoginForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const isConfigured = supabase != null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const redirectTo =
    typeof window !== "undefined"
      ? safeNextPath(new URLSearchParams(window.location.search).get("next"))
      : "/portal";

  // Surface the callback's error after hydration (window-only, so not in
  // the initial render where server and client markup must match).
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code && CALLBACK_ERRORS[code]) {
      setError(CALLBACK_ERRORS[code]);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      setError("Supabase ayarlari Vercel-de tam qurasdirilmayib.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  // Google: the browser goes to Google, then to Supabase, then back to our
  // /auth/callback, which exchanges the code for a session and continues to
  // `next`. Sign-ups are disabled in Supabase, so only a Gmail address that
  // İsmayıl pre-created can finish this; everyone else lands back here with
  // ?error=not_invited.
  const onGoogle = async () => {
    if (!supabase) {
      setError("Supabase ayarlari Vercel-de tam qurasdirilmayib.");
      return;
    }

    setGoogleLoading(true);
    setError(null);

    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", redirectTo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });

    if (error) {
      setGoogleLoading(false);
      setError(CALLBACK_ERRORS.google);
    }
    // On success the browser is navigating away; keep the spinner.
  };

  return (
    <m.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase tracking-[0.22em] text-black/45 dark:text-white/50">
          E-poct
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-b border-brand-green/30 bg-transparent px-0 py-2 text-black dark:text-white/90 outline-none transition focus:border-brand-green"
          placeholder="ad@example.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase tracking-[0.22em] text-black/45 dark:text-white/50">
          Sifre
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-b border-brand-green/30 bg-transparent px-0 py-2 text-black dark:text-white/90 outline-none transition focus:border-brand-green"
          placeholder="********"
        />
      </div>

      {!isConfigured ? (
        <div className="text-xs leading-5 text-black/55 dark:text-white/60">
          Supabase ayarlari hazir deyil. Vercel-e
          {" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code>
          {" "}
          ve
          {" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          {" "}
          elave edilenden sonra giris aktiv olacaq.
        </div>
      ) : null}

      {error ? <div className="text-xs text-brand-red dark:text-red-400">{error}</div> : null}

      <button
        type="submit"
        disabled={loading || googleLoading || !isConfigured}
        className="mt-4 rounded-xl bg-brand-green px-4 py-3 text-sm font-medium uppercase tracking-[0.18em] text-white shadow-glass-green transition hover:-translate-y-0.5 hover:bg-brand-green-soft disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {!isConfigured
          ? "Qurasdirma gozlenilir"
          : loading
            ? "Daxil olunur..."
            : "Daxil ol"}
      </button>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-black/35 dark:text-white/40">
        <span className="h-px flex-1 bg-brand-green/20" aria-hidden />
        və ya
        <span className="h-px flex-1 bg-brand-green/20" aria-hidden />
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={loading || googleLoading || !isConfigured}
        className="flex items-center justify-center gap-3 rounded-xl border border-brand-green/20 bg-white/70 dark:bg-white/10 px-4 py-3 text-sm font-medium uppercase tracking-[0.18em] text-black/70 dark:text-white/75 transition hover:-translate-y-0.5 hover:border-brand-green hover:text-brand-green dark:hover:text-emerald-400 disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <GoogleMark />
        {googleLoading ? "Google-a yönləndirilir..." : "Google ilə daxil ol"}
      </button>
    </m.form>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3a7.2 7.2 0 0 1-10.73-3.78H1.34v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.34 14.31a7.2 7.2 0 0 1 0-4.62V6.6H1.34a12 12 0 0 0 0 10.8l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.34 6.6l4 3.09A7.17 7.17 0 0 1 12 4.75Z"
      />
    </svg>
  );
}
