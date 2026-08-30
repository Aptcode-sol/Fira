/**
 * Entrance animation wrappers.
 *
 * Imported statically, not via `dynamic(..., { ssr: false })` as they were before.
 *
 * The dynamic import was meant to keep framer-motion out of the initial bundle, but
 * Navbar, Footer and FloatingActionButton all import framer-motion directly and all
 * three render on every route - so it was already in the initial bundle and the
 * split saved nothing. What it did cost was real: `ssr: false` means these wrappers
 * render nothing on the server, so every page shipped with its content missing,
 * then waited for a separate chunk, hydrated at opacity 0, and only then animated.
 * That gap before anything appeared is most of what "very slow" was.
 *
 * Static imports mean the markup is in the HTML and the animation starts on the
 * first frame instead of after a round trip.
 */
export { default as FadeIn } from './FadeIn';
export { default as SlideUp } from './SlideUp';
export { default as ScaleIn } from './ScaleIn';
export { default as StaggerContainer, StaggerItem } from './StaggerContainer';
