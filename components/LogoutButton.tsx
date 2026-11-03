"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ICON_BTN } from "@/components/iconButton";

/**
 * The round exit button of the fund and bank headers (İsmayıl's call: an
 * icon in the cluster instead of the "ÇIXIŞ" word). Signs out and lands on
 * /login; without Supabase config it points at the setup page instead.
 */
export function LogoutButton() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const onLogout = async () => {
    if (!supabase) {
      router.push("/welcome?setup=supabase");
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      aria-label="Çıxış"
      title="Çıxış"
      className={ICON_BTN}
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  );
}
