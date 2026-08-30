'use client';

import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import CreateEventModal from '@/components/modals/CreateEventModal';

/**
 * Deep-link route for event creation.
 *
 * The form itself is a modal mounted app-wide (CreateEventLauncher), so buttons
 * open it in place. This route is kept for shared links and for the
 * `?redirect=/create/event` sign-in bounce, and renders the same modal.
 *
 * Close does `router.back()` rather than pushing anywhere: the old version pushed
 * to /dashboard/events, which is where a *successful* create lands - so cancelling
 * was indistinguishable from succeeding. Going back returns the user to whatever
 * they were on before following the link.
 */
export default function CreateEventPage() {
    const router = useRouter();

    return (
        <>
            <PartyBackground />
            <Navbar />
            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-2xl mx-auto text-center">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Create Event</h1>
                    <p className="text-gray-300">Fill in the details to create your event</p>
                </div>
            </main>

            <CreateEventModal isOpen onClose={() => router.back()} />
        </>
    );
}
