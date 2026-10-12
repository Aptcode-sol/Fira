/**
 * /api/auth/refresh — sliding session expiry.
 *
 * supertest over the REAL auth router (bare express app, real User + signed
 * JWT), so the `auth` middleware and the refreshSession service run as they
 * ship. This is the check behind the "keeps logging out" fix: an authenticated
 * user can trade a valid token for a fresh one, and a request with no token is
 * refused — exactly the two paths the client's silent-refresh relies on.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import './setup';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
delete process.env.REDIS_HOST; // skip the Redis blocklist path in auth

const authRoutes = require('../routes/auth');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

const tokenFor = (u: any) => jwt.sign({ userId: String(u._id), role: u.role }, process.env.JWT_SECRET as string);

async function makeUser() {
  return User.create({
    name: 'Refresh Rita',
    email: `${new mongoose.Types.ObjectId()}@x.test`,
    password: 'x',
    role: 'user',
    roles: ['user'],
    emailVerified: true,
  });
}

describe('POST /api/auth/refresh', () => {
  it('returns a fresh token and the current user for a valid session', async () => {
    const user = await makeUser();
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send();

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.user._id).toBe(String(user._id));
    expect(res.body.user.email).toBe(user.email);

    // The fresh token must itself verify and point at the same user.
    const decoded: any = jwt.verify(res.body.token, process.env.JWT_SECRET as string);
    expect(decoded.userId).toBe(String(user._id));
  });

  it('rejects a request with no token (nothing to slide forward)', async () => {
    const res = await request(app).post('/api/auth/refresh').send();
    expect(res.status).toBe(401);
  });
});
