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
};

// ponytail: withSentryConfig is a no-op when NEXT_PUBLIC_SENTRY_DSN is unset —
// it wraps the webpack config but only uploads source maps when the DSN is present.
export default withSentryConfig(nextConfig, {
  // Suppress source map upload warnings when DSN is not configured
  silent: true,
});
