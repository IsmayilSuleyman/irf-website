"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ThemeButton } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";
import { HEADER_DIVIDER, ICON_BTN } from "@/components/iconButton";

// The İsmayılBank header (/bank, /bonds) — the mirror image of the fund
// header: wordmark on the left, the same round icon cluster on the right —
//   date · bell · theme | Fond · exit · account
// where Fond is the round İRF mark leading back to the family portfolio
// (İsmayıl: "Fond button will be added on the top navigation panel,
// alongside light-dark mode change, exit button, notifications"). The
// phone dock below carries the bank's own tabs (Hesabım · Hesabla ·
// İstiqraz). No bottom border, like the fund header.

export function BankHeader({
  dateLabel,
  isFamily = true,
  initials,
}: {
  dateLabel: string;
  /** false for an external member: no İRF link, no portal — /bank is home. */
  isFamily?: boolean;
  /** Viewer's initials for the account button (→ /portal). */
  initials?: string | null;
}) {
  return (
    <m.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-40 bg-white/80 px-6 backdrop-blur-xl dark:bg-white/10 sm:sticky sm:top-0"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 py-3.5 sm:py-4">
        <Link
          href="/bank"
          aria-label="İsmayılBank hesabına keç"
          className="shrink-0"
        >
          <IsmayilBankLogo size={28} />
        </Link>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          <span className="num mr-1 hidden text-xs text-black/45 dark:text-white/50 lg:inline">
            {dateLabel}
          </span>
          <NotificationsBell />
          <ThemeButton />

          <span aria-hidden className={HEADER_DIVIDER} />
          {isFamily ? (
            <Link
              href="/dashboard"
              aria-label="İRF portfelinə keç"
              title="İsmayıl Rifah Fondu"
              className={ICON_BTN}
            >
              <img
                src="/images/irf-mark.png"
                alt=""
                aria-hidden
                className="h-[18px] w-[18px]"
              />
            </Link>
          ) : null}
          <LogoutButton />
          {isFamily && initials ? (
            <Link
              href="/portal"
              aria-label="Portal — İRF və İsmayılBank arasında seç"
              title="Portal"
              className={`${ICON_BTN} hidden text-[11px] font-bold tracking-[0.06em] sm:inline-flex`}
            >
              {initials}
            </Link>
          ) : null}
        </div>
      </div>
    </m.header>
  );
}
