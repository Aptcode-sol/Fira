'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreatePage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to event creation as the primary create action
        // Venue creation is now only available through venue-portal
        // Brand application is available through dashboard
        router.replace('/create/event');
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
        </div>
    );
}
