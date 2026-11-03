"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { IsmayilBankMark } from "@/components/IsmayilBankLogo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ThemeButton } from "@/components/ThemeToggle";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { LogoutButton } from "@/components/LogoutButton";
import { HEADER_DIVIDER, ICON_BTN, iconBtn } from "@/components/iconButton";

// The Rifah Fondu header (dashboard + market). One row: the logo on the
// left, a cluster of round icon buttons on the right —
//   date · bell · theme · eye | Fond · İsmayılBank | exit · account
// The Fond button is the Ümumfond switch (it replaced the "Mənim portfelim |
// Ümumfond" segment that used to sit under the greeting): plain on the
// personal view, lit green on the fund view, pressing it toggles between
// the two. The round İsmayılBank mark leads to /bank (the old wordmark
// button with "Hesabına keç" is gone — İsmayıl: "buttonize this, as we did
// with the mobile version"). No bottom border: the blurred background alone
// marks the edge. Sticky from sm up; on phones it scrolls away with the
// page and the glass dock does the navigation.

function FondToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active ? "Ümumfond açıqdır — Mənim portfelimə qayıt" : "Ümumfonda keç"
      }
      title="Ümumfond"
      onClick={() =>
        router.push(active ? pathname : `${pathname}?view=fund`, {
          scroll: false,
        })
      }
      // Phones switch views from the dock's Fond tab; the header button is
      // the desktop control.
      className={`${iconBtn(active)} hidden sm:inline-flex`}
    >
      <img
        src="/images/irf-mark.png"
        alt=""
        aria-hidden
        className="h-[18px] w-[18px]"
      />
    </button>
  );
}

export function Header({
  dateLabel,
  isFamily = true,
  fundView,
  privacy = false,
  initials,
}: {
  dateLabel: string;
  /** false for an external member on /market: the logo leads back to his
   *  bank page instead of the family portfolio, and there is no portal. */
  isFamily?: boolean;
  /** The dashboard passes which view is on; the Fond toggle renders only
   *  then (the market page has no view to switch). */
  fundView?: boolean;
  /** Show the hide-amounts eye (needs a PrivacyProvider above). */
  privacy?: boolean;
  /** Viewer's initials for the account button (→ /portal). */
  initials?: string | null;
}) {
  return (
    <m.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-40 -mx-6 mb-6 bg-white/55 px-6 backdrop-blur-md dark:bg-white/5 sm:sticky sm:top-0 sm:mb-8"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 py-3.5 sm:py-4">
        <Link
          href={isFamily ? "/dashboard" : "/bank"}
          aria-label={isFamily ? "İRF portfelinə keç" : "İsmayılBank hesabına keç"}
          className="w-[128px] shrink-0 sm:w-[170px]"
        >
          <Logo width={170} priority />
        </Link>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          <span className="num mr-1 hidden text-xs text-black/45 dark:text-white/50 lg:inline">
            {dateLabel}
          </span>
          <NotificationsBell />
          <ThemeButton />
          {privacy ? <PrivacyToggle size="header" /> : null}

          {fundView != null || isFamily ? (
            <span aria-hidden className={HEADER_DIVIDER} />
          ) : null}
          {fundView != null ? <FondToggle active={fundView} /> : null}
          <Link
            href="/bank"
            aria-label="İsmayılBank hesabına keç"
            title="İsmayılBank"
            className={ICON_BTN}
          >
            <IsmayilBankMark size={18} />
          </Link>

          <span aria-hidden className={HEADER_DIVIDER} />
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
