'use client';

import { useEffect } from 'react';

export default function VenuesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[VenuesError]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6" role="alert" aria-live="assertive">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-white mb-3">
          Failed to load venues
        </h2>
        <p className="text-gray-300 mb-8">
          Something went wrong while loading venues. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
