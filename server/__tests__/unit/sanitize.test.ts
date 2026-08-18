import { describe, it, expect, vi } from 'vitest';

const sanitize = require('../../middleware/sanitize');

function mockReqResNext(body = {}, query = {}, params = {}) {
  const req = { body, query, params } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('sanitize middleware', () => {
  it('allows clean input and calls next()', () => {
    const { req, res, next } = mockReqResNext(
      { name: 'John', age: 30 },
      { page: '1' },
    );
    sanitize(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects body with $ operator key and returns 400', () => {
    const { req, res, next } = mockReqResNext({ $gt: 100 });
    sanitize(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('$gt') }),
    );
  });

  it('rejects nested $ operator key', () => {
    const { req, res, next } = mockReqResNext({ filter: { price: { $gte: 10 } } });
    sanitize(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects $ in query params', () => {
    const { req, res, next } = mockReqResNext({}, { $where: 'true' });
    sanitize(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
