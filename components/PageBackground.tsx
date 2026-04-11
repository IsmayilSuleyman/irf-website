"use client";

import { motion } from "framer-motion";

/**
 * Fixed-position decorative layer rendering large blurred green "orbs"
 * that drift slowly behind the page content. Adapted from SOURCE/FloatingOrbs.
 */
export function PageBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <motion.div
        className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(22,163,74,0.18) 0%, rgba(22,163,74,0) 65%)",
          filter: "blur(40px)",
        }}
        animate={{
          x: [0, 60, -20, 0],
          y: [0, 40, 20, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-1/3 -right-40 h-[640px] w-[640px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(34,197,94,0.14) 0%, rgba(34,197,94,0) 65%)",
          filter: "blur(50px)",
        }}
        animate={{
          x: [0, -50, 30, 0],
          y: [0, -30, 40, 0],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-40 left-1/4 h-[480px] w-[480px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(22,163,74,0.12) 0%, rgba(22,163,74,0) 65%)",
          filter: "blur(45px)",
        }}
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 10, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
