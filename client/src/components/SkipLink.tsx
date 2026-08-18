'use client';

/**
 * Skip navigation link — first focusable element in the DOM.
 * Hidden off-screen via sr-only; becomes visible on focus with 4.5:1+ contrast.
 * ponytail: minimal a11y primitive; no abstraction beyond what WCAG 2.1 AA requires.
 */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded focus:bg-neutral-900 focus:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
    >
      Skip to content
    </a>
  );
}
