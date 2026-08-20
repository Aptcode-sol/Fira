import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import ScrollToTop from '@/components/ScrollToTop';
import SkipLink from '@/components/SkipLink';
import ClientLayout from './ClientLayout';
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  API_BASE_URL,
} from '@/lib/siteConfig';
import { JsonLd, organizationSchema, websiteSchema } from '@/lib/seo/jsonLd';

import { Inter, Fascinate } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

const fascinate = Fascinate({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-fascinate',
});

export const metadata: Metadata = {
  // metadataBase makes every relative OG/canonical URL resolve to an absolute
  // one. Without it Next emits relative URLs that crawlers and social scrapers
  // cannot follow.
  metadataBase: new URL(SITE_URL),
  title: {
    // Brand-first. "FIRA" has to be the first token a crawler sees so the site
    // has a chance of being associated with the brand name at all.
    default: `${SITE_NAME} - ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'FIRA',
    'letsfira',
    'FIRA events',
    'event venues India',
    'venue booking',
    'book banquet hall',
    'event tickets',
    'party venues near me',
    'concerts near me',
    'host an event',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'events',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: '/',
    type: 'website',
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
  },
  // Ownership proof for Search Console. Set the token in the environment, or
  // verify the property via a DNS TXT record instead.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  other: {
    // Helps disambiguate the brand for engines that read these hints.
    'application-name': SITE_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

// Site-wide entity graph: who we are (Organization) and what this site is
// (WebSite). Emitted on every page so any entry point carries the brand facts.
const siteGraph = {
  '@context': 'https://schema.org',
  '@graph': [organizationSchema(), websiteSchema()],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // en-IN, not en: the audience, currency and city names are all Indian.
    <html lang="en-IN">
      <head>
        {/* Cuts a round-trip on the first events/venues fetch. */}
        <link rel="preconnect" href={new URL(API_BASE_URL).origin} />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <JsonLd data={siteGraph} />
      </head>
      <body className={`${inter.variable} ${fascinate.variable} antialiased`}>
        <SkipLink />
        <AuthProvider>
          <ToastProvider>
            <ScrollToTop />
            <ClientLayout>
              <main id="main-content" tabIndex={-1}>
                {children}
              </main>
            </ClientLayout>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
