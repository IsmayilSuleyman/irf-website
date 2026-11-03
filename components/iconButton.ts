// The round icon buttons of the page headers (bell, theme, eye, Fond,
// İsmayılBank, exit) — one recipe so the fund and bank headers read as
// siblings. Phones get 34px (five of them beside the logo still fit a
// 360px screen), sm+ 36px. Sizing and skin are separate strings so a
// pressed state can swap the skin without two border-colour utilities
// fighting over stylesheet order.
export const ICON_BTN_BASE =
  "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border shadow-sm transition hover:-translate-y-px sm:h-9 sm:w-9";

export const ICON_BTN_SKIN =
  "border-black/10 bg-white/80 text-black/55 hover:text-black/85 dark:border-white/15 dark:bg-white/10 dark:text-white/65 dark:hover:text-white/90";

/** Pressed / active skin — the Fond toggle on the Ümumfond view, the eye in hide mode. */
export const ICON_BTN_SKIN_ON =
  "border-brand-green/40 bg-brand-green/10 text-brand-green hover:text-brand-green dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-400 dark:hover:text-emerald-400";

export const ICON_BTN = `${ICON_BTN_BASE} ${ICON_BTN_SKIN}`;

export const iconBtn = (on = false) =>
  `${ICON_BTN_BASE} ${on ? ICON_BTN_SKIN_ON : ICON_BTN_SKIN}`;

/** Thin vertical rule between the header cluster's groups (sm+ only). */
export const HEADER_DIVIDER =
  "mx-0.5 hidden h-5 w-px shrink-0 bg-black/10 dark:bg-white/15 sm:block";
