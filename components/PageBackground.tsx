/**
 * Fixed-position decorative layer rendering large blurred green "orbs"
 * that drift slowly behind the page content. Adapted from SOURCE/FloatingOrbs.
 *
 * Pure CSS keyframes (see globals.css `orb-drift-*`): the old framer-motion
 * version pulled the whole animation runtime into every page's first load
 * and kept a JS animation loop ticking forever; the compositor handles a
 * transform keyframe for free. Server component — zero client JS.
 */
export function PageBackground() {
  return (
    <div
      aria-hidden
      // Orbs are tuned for the light gradient; dim them in dark mode so
      // they read as a faint glow instead of bright green patches.
      // `page-orbs`: hidden on iOS WebKit (see the crash-mitigation block in
      // globals.css) — endlessly animating blurred layers pin GPU memory and
      // repeatedly crash the tab there.
      className="page-orbs pointer-events-none fixed inset-0 -z-10 overflow-hidden dark:opacity-35"
    >
      <div
        className="orb-drift-1 absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(22,163,74,0.18) 0%, rgba(22,163,74,0) 65%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="orb-drift-2 absolute top-1/3 -right-40 h-[640px] w-[640px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(34,197,94,0.14) 0%, rgba(34,197,94,0) 65%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="orb-drift-3 absolute -bottom-40 left-1/4 h-[480px] w-[480px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(22,163,74,0.12) 0%, rgba(22,163,74,0) 65%)",
          filter: "blur(45px)",
        }}
      />
    </div>
  );
}
