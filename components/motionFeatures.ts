// Split into its own module so LazyMotion can load the animation features
// as a separate async chunk (see MotionProvider). domAnimation covers
// everything the app uses: animate/exit (AnimatePresence), whileInView,
// hover/tap gestures. domMax (drag, layout animations) is not needed.
export { domAnimation as default } from "framer-motion";
