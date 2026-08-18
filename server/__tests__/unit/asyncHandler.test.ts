import { describe, it, expect, vi } from 'vitest';

const asyncHandler = require('../../middleware/asyncHandler');

describe('asyncHandler middleware', () => {
  it('calls the wrapped async function and resolves normally', async () => {
    const handler = asyncHandler(async (req: any, res: any) => {
      res.json({ ok: true });
    });

    const req = {} as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    await handler(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards thrown errors to next()', async () => {
    const error = new Error('something broke');
    const handler = asyncHandler(async () => {
      throw error;
    });

    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('forwards rejected promise to next()', async () => {
    const error = new Error('rejected');
    const handler = asyncHandler(() => Promise.reject(error));

    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
