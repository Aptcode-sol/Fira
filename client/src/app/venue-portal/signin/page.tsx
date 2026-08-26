import { redirect } from 'next/navigation';

// Venue-owner auth space retired: all accounts authenticate through the
// Unified_Sign_In. Server-component redirect fires before any client JS, so
// there is no flash of the old form. File kept (not deleted) so the route
// resolves and redirects rather than 404s.
export default function Page() {
    redirect('/signin');
}
