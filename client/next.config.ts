import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Pin the monorepo root: stray lockfiles above the repo (e.g. in the user's home dir)
  // otherwise make Next infer the wrong workspace root, which breaks Turbopack's PostCSS
  // path resolution on Windows. Must be the workspace root, since `next` hoists there.
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  /**
   * Venue management lives in the venue portal only.
   *
   * These two /dashboard routes were second copies of screens the venue portal
   * already owns: /dashboard/venues listed the same venues as
   * /venue-portal/venues, and /dashboard/requests combined the same booking and
   * event-request queues as /venue-portal/bookings and /venue-portal/events. Old
   * bookmarks and any link still pointing at them land on the live screen instead
   * of a stale duplicate.
   *
   * ponytail: config redirects rather than stub pages - no component, no effect, no
   * flash of a loading state. Deliberately NOT `/dashboard/venues/:path*`:
   * /dashboard/venues/[id] is the per-venue management screen (photo ordering, date
   * blocking, activate/delete, auto-approve) and has no venue-portal equivalent, so
   * it stays. It is reached from the "Manage" action on the venue portal's list.
   *
   * Session is held in localStorage, so a same-origin redirect keeps the user
   * signed in.
   */
  async redirects() {
    return [
      { source: '/dashboard/venues', destination: '/venue-portal/venues', permanent: false },
      { source: '/dashboard/requests', destination: '/venue-portal/events', permanent: false },
      /**
       * Retired standalone policy pages. Their content now lives inside the main
       * Terms & Conditions, so the old URLs land on the matching section instead
       * of 404-ing. Keeps existing inbound links, crawled URLs, and the privacy /
       * refund URLs registered with the payment gateway working.
       *
       * ponytail: redirects rather than three stub pages. Permanent (308) because
       * the pages are not coming back.
       */
      { source: '/privacy', destination: '/terms#data-protection', permanent: true },
      { source: '/refund-policy', destination: '/terms#refunds', permanent: true },
      { source: '/community-guidelines', destination: '/terms#conduct', permanent: true },
    ];
  },
};

// ponytail: withSentryConfig is a no-op when NEXT_PUBLIC_SENTRY_DSN is unset —
// it wraps the webpack config but only uploads source maps when the DSN is present.
export default withSentryConfig(nextConfig, {
  // Suppress source map upload warnings when DSN is not configured
  silent: true,
});
