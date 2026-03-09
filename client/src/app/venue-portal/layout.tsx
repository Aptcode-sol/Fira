import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "FIRA Venue Portal - Manage Your Venues",
    description: "List and manage your venues on FIRA. The leading platform for venue owners to connect with event organizers.",
};

export default function VenuePortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
