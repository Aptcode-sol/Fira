// ponytail: Sentry init is a no-op when SENTRY_DSN is absent.
// Upgrade path: add custom tags, breadcrumbs, or beforeSend filtering as needed.
const Sentry = require('@sentry/node');

const SENTRY_DSN = process.env.SENTRY_DSN;

function init(app) {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.2,
    integrations: [
      // Express request context + performance tracing
      Sentry.expressIntegration(),
    ],
  });

  // Request handler must be the first middleware
  app.use(Sentry.expressRequestHandler());
}

function errorHandler() {
  if (!SENTRY_DSN) {
    // Return a no-op error middleware when Sentry is disabled
    return (err, _req, _res, next) => next(err);
  }
  return Sentry.expressErrorHandler();
}

module.exports = { init, errorHandler, Sentry };
