'use strict';

/**
 * Self-check for roleGuard middleware.
 * Run: node server/middleware/roleGuard.test.js
 */

const assert = require('assert');
const roleGuard = require('./roleGuard');

// Helper to build minimal req/res/next
function makeCtx(adminRole) {
  let statusCode = null;
  let body = null;
  let nextCalled = false;

  const req = { user: adminRole !== undefined ? { adminRole } : null };
  const res = {
    status(code) { statusCode = code; return res; },
    json(b) { body = b; return res; },
  };
  const next = () => { nextCalled = true; };

  return { req, res, next, result: () => ({ statusCode, body, nextCalled }) };
}

// 1. Allowed role passes through
{
  const { req, res, next, result } = makeCtx('super_admin');
  roleGuard(['super_admin', 'admin'])(req, res, next);
  assert.strictEqual(result().nextCalled, true, 'super_admin should pass');
  assert.strictEqual(result().statusCode, null, 'No status should be set on pass');
}

// 2. Another allowed role passes
{
  const { req, res, next, result } = makeCtx('admin');
  roleGuard(['super_admin', 'admin'])(req, res, next);
  assert.strictEqual(result().nextCalled, true, 'admin should pass');
}

// 3. Disallowed role gets 403
{
  const { req, res, next, result } = makeCtx('moderator');
  roleGuard(['super_admin', 'admin'])(req, res, next);
  assert.strictEqual(result().nextCalled, false, 'moderator should not pass');
  assert.strictEqual(result().statusCode, 403, 'Should return 403');
  assert.strictEqual(result().body.error, 'Insufficient permissions for this action');
}

// 4. No adminRole (null) gets 403
{
  const { req, res, next, result } = makeCtx(null);
  roleGuard(['super_admin'])(req, res, next);
  assert.strictEqual(result().nextCalled, false, 'null adminRole should not pass');
  assert.strictEqual(result().statusCode, 403);
}

// 5. No user on req gets 403
{
  let statusCode = null;
  let body = null;
  let nextCalled = false;
  const req = {};
  const res = { status(c) { statusCode = c; return res; }, json(b) { body = b; return res; } };
  roleGuard(['super_admin'])(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false, 'Missing req.user should not pass');
  assert.strictEqual(statusCode, 403);
}

console.log('✅ roleGuard self-check: all assertions passed');
