import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const validate = require('../../middleware/validate');

// Mirror the schema wired into server/routes/venue.js (Req 20.2 maps-link validation).
// Kept in the test as the contract under check: locationLink is optional, '' clears it,
// a non-empty value must be a valid URL, and all other venue fields pass through.
const locationLinkBody = z.object({
  locationLink: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().url().safeParse(v).success, {
      message: 'locationLink must be a valid URL',
    })
    .optional(),
}).passthrough();

function run(body: unknown) {
  let statusCode: number | null = null;
  let json: any = null;
  let nextCalled = false;
  const req: any = { body };
  const res: any = {
    status(c: number) { statusCode = c; return res; },
    json(b: any) { json = b; return res; },
  };
  validate(locationLinkBody)(req, res, () => { nextCalled = true; });
  return { statusCode, json, nextCalled, body: req.body };
}

describe('venue locationLink (maps link) validation — Req 20.2', () => {
  it('accepts a valid https maps URL and persists it (preservation 21.2)', () => {
    const r = run({ name: 'Hall', locationLink: 'https://maps.google.com/?q=x' });
    expect(r.nextCalled).toBe(true);
    expect(r.statusCode).toBe(null);
    expect(r.body.locationLink).toBe('https://maps.google.com/?q=x');
  });

  it('rejects an invalid link with 400 + a clear message', () => {
    const r = run({ name: 'Hall', locationLink: 'not a url' });
    expect(r.nextCalled).toBe(false);
    expect(r.statusCode).toBe(400);
    expect(r.json.error).toBe('Validation failed');
    expect(r.json.details[0].field).toBe('locationLink');
    expect(r.json.details[0].message).toMatch(/valid URL/);
  });

  it('allows an empty string (clearing the link)', () => {
    const r = run({ name: 'Hall', locationLink: '' });
    expect(r.nextCalled).toBe(true);
    expect(r.body.locationLink).toBe('');
  });

  it('allows the field to be omitted entirely', () => {
    const r = run({ name: 'Hall' });
    expect(r.nextCalled).toBe(true);
  });

  it('passes other venue fields through unchanged', () => {
    const r = run({ name: 'Hall', capacity: { min: 1, max: 200 }, isActive: true });
    expect(r.nextCalled).toBe(true);
    expect(r.body.name).toBe('Hall');
    expect(r.body.capacity).toEqual({ min: 1, max: 200 });
    expect(r.body.isActive).toBe(true);
  });
});
