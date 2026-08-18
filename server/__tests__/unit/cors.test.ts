import { describe, it, expect, vi, beforeAll } from 'vitest';

// Set env before loading the module (cors.js reads it at module load)
process.env.CORS_ALLOWED_ORIGINS = 'https://app.fira.com,https://admin.fira.com';
process.env.NODE_ENV = 'production';

const corsMiddleware = require('../../middleware/cors');

function mockReqResNext(origin?: string, method = 'GET') {
  const req = {
    headers: origin ? { origin } : {},
    method,
  } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('cors middleware', () => {
  it('allows request from an allowed origin and sets headers', () => {
    const { req, res, next } = mockReqResNext('https://app.fira.com');
    corsMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://app.fira.com');
  });

  it('rejects request from a disallowed origin with 403', () => {
    const { req, res, next } = mockReqResNext('https://evil.com');
    corsMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('responds 204 to preflight OPTIONS from allowed origin', () => {
    const { req, res, next } = mockReqResNext('https://admin.fira.com', 'OPTIONS');
    corsMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through requests with no Origin header (same-origin/curl)', () => {
    const { req, res, next } = mockReqResNext(undefined);
    corsMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
