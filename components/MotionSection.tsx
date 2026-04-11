"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type MotionSectionProps = HTMLMotionProps<"section"> & {
  delay?: number;
};

/**
 * Wrapper around <section> that fades + slides in once it scrolls into view.
 * Used to give dashboard sections a staggered reveal matching SOURCE.
 */
export function MotionSection({
  children,
  delay = 0,
  ...rest
}: MotionSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}
