import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';

import { Fascinate } from 'next/font/google';

const fascinate = Fascinate({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-fascinate',
});

export const metadata: Metadata = {
  title: "FIRA - Premium Event Venues & Management Platform",
  description: "Connect with premium venues and create unforgettable events. FIRA is the leading platform for venue booking, event management, and ticket sales with verified organizers and locations.",
  keywords: "event venues, venue booking, event management, party planning, event tickets, private events, verified venues",
  authors: [{ name: "FIRA" }],
  openGraph: {
    title: "FIRA - Premium Event Venues & Management Platform",
    description: "Connect with premium venues and create unforgettable events.",
    type: "website",
    siteName: "FIRA",
  },
  twitter: {
    card: "summary_large_image",
    title: "FIRA - Premium Event Venues & Management Platform",
    description: "Connect with premium venues and create unforgettable events.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${fascinate.variable} antialiased`}>
        <AuthProvider>
          <ToastProvider>
            <ScrollToTop />
            {children}
            <Footer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

