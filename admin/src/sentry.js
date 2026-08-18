// ponytail: No-op when VITE_SENTRY_DSN is absent.
// Upgrade path: add Sentry.reactRouterV7BrowserTracingIntegration when needed.
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    tracesSampleRate: 0.2,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  });
}

export { Sentry };
