'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');
const pino = require('pino');
const pinoHttp = require('pino-http');

// ─── AsyncLocalStorage for requestId propagation ───────────────────────────────
const asyncLocalStorage = new AsyncLocalStorage();

// ─── JWT pattern: "eyJ" followed by base64url chars separated by dots ──────────
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function redactJwt(value) {
  if (typeof value !== 'string') return value;
  return value.replace(JWT_PATTERN, '[TOKEN_REDACTED]');
}

// ─── Pino configuration ────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  // ponytail: pino built-in redaction paths — covers nested objects in log payloads
  redact: {
    paths: [
      'password',
      'token',
      'refreshToken',
      'secret',
      'accountNumber',
      'ifsc',
      'pan',
      'aadhaar',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.refreshToken',
      '*.secret',
      '*.accountNumber',
      '*.ifsc',
      '*.pan',
      '*.aadhaar',
    ],
    censor: '[REDACTED]',
  },
  // Custom serializer to catch JWT tokens that slip through non-redacted string fields
  serializers: {
    req: (req) => {
      const serialized = pino.stdSerializers.req(req);
      if (serialized.headers && serialized.headers.authorization) {
        serialized.headers.authorization = redactJwt(serialized.headers.authorization);
      }
      return serialized;
    },
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  mixin() {
    const store = asyncLocalStorage.getStore();
    return store ? { requestId: store.requestId } : {};
  },
});

// ─── pino-http middleware ──────────────────────────────────────────────────────
const LOG_REQUEST_BODY = process.env.LOG_REQUEST_BODY === 'true' && !isProduction;
const BODY_TRUNCATE_LIMIT = 500;

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    // If upstream (e.g. nginx) already set X-Request-Id, reuse it; otherwise generate
    const existing = req.headers['x-request-id'];
    return existing || randomUUID();
  },
  customProps: (req) => {
    const props = {};
    if (LOG_REQUEST_BODY && req.body && Object.keys(req.body).length > 0) {
      let bodyStr = JSON.stringify(req.body);
      if (bodyStr.length > BODY_TRUNCATE_LIMIT) {
        bodyStr = bodyStr.slice(0, BODY_TRUNCATE_LIMIT) + '…[truncated]';
      }
      // Redact JWTs from body logging too
      props.requestBody = redactJwt(bodyStr);
    }
    return props;
  },
  // Suppress the automatic request-completed log for health checks to reduce noise
  autoLogging: {
    ignore: (req) => req.url === '/' || req.url === '/api/v1/health',
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
});

// ─── Middleware that wraps request in AsyncLocalStorage context ─────────────────
function requestContextMiddleware(req, res, next) {
  // pino-http sets req.id via genReqId — run httpLogger first, then wrap context
  const requestId = req.id || randomUUID();
  asyncLocalStorage.run({ requestId }, () => {
    // Set response header so clients can correlate
    res.setHeader('X-Request-Id', requestId);
    next();
  });
}

// ─── Combined middleware: pinoHttp + asyncLocalStorage context ──────────────────
function loggingMiddleware(req, res, next) {
  // First, attach pino-http (sets req.id, req.log)
  httpLogger(req, res, () => {
    // Then wrap the rest in AsyncLocalStorage so downstream code gets requestId
    requestContextMiddleware(req, res, next);
  });
}

// ─── Child logger helper — use in services/controllers ─────────────────────────
function createChildLogger(bindings) {
  return logger.child(bindings);
}

module.exports = {
  logger,
  loggingMiddleware,
  asyncLocalStorage,
  createChildLogger,
  redactJwt,
};
