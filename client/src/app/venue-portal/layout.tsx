import type { Metadata } from "next";

/**
 * Metadata for the venue-owner side of the product.
 *
 * This is the description Google shows if it surfaces the Venue Portal as a
 * sitelink, so it has to explain the offer to a venue owner in one line rather
 * than describe the platform generically. Every child route inherits it unless
 * it sets its own.
 */
export const metadata: Metadata = {
    title: "Venue Portal - List Your Venue on FIRA",
    description:
        "List your venue on FIRA and take bookings from event organisers across India. Set your own pricing and availability, approve every request, and get paid securely. Free to list.",
    alternates: { canonical: "/venue-portal" },
    openGraph: {
        title: "Venue Portal - List Your Venue on FIRA",
        description:
            "List your venue on FIRA and take bookings from event organisers across India. Free to list, you approve every request.",
        url: "/venue-portal",
        type: "website",
    },
};

export default function VenuePortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
