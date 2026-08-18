'use strict';

/**
 * Self-check for httpCache middleware.
 * Run: node server/middleware/httpCache.test.js
 */

const assert = require('assert');
const { computeETag, publicCache, noStoreCache } = require('./httpCache');

// --- computeETag ---
const etag1 = computeETag('{"events":[]}');
const etag2 = computeETag('{"events":[]}');
assert.strictEqual(etag1, etag2, 'Identical content must produce identical ETag');

const etag3 = computeETag('{"events":[{"id":1}]}');
assert.notStrictEqual(etag1, etag3, 'Different content must produce different ETag');

assert(etag1.startsWith('W/"'), 'ETag should be a weak validator');

// --- publicCache middleware (304 flow) ---
{
    const body = { events: [{ id: 'abc' }] };
    const bodyStr = JSON.stringify(body);
    const expectedETag = computeETag(bodyStr);

    let sentStatus = null;
    let ended = false;
    let headers = {};

    const req = { method: 'GET', headers: { 'if-none-match': expectedETag } };
    const res = {
        statusCode: 200,
        setHeader(k, v) { headers[k] = v; },
        removeHeader(k) { delete headers[k]; },
        status(code) { sentStatus = code; return res; },
        end() { ended = true; return res; },
        json(b) { /* original json — would send body */ return res; },
    };

    publicCache(req, res, () => {});
    // Now call res.json like the route handler would
    res.json(body);

    assert.strictEqual(sentStatus, 304, 'Should return 304 when ETag matches');
    assert.strictEqual(ended, true, 'Should end response without body');
}

// --- publicCache middleware (200 flow with ETag + Cache-Control) ---
{
    const body = { venues: [{ id: 'v1' }] };
    let calledWith = null;
    let headers = {};

    const req = { method: 'GET', headers: {} };
    const res = {
        statusCode: 200,
        setHeader(k, v) { headers[k] = v; },
        removeHeader() {},
        status(code) { return res; },
        end() { return res; },
        json(b) { calledWith = b; return res; },
    };

    publicCache(req, res, () => {});
    res.json(body);

    assert.strictEqual(headers['Cache-Control'], 'public, max-age=60', 'Should set public cache-control');
    assert(headers['ETag'], 'Should set ETag header');
    assert.deepStrictEqual(calledWith, body, 'Should pass body through to original json');
}

// --- noStoreCache middleware ---
{
    let headers = {};
    const req = {};
    const res = { setHeader(k, v) { headers[k] = v; } };
    let nextCalled = false;

    noStoreCache(req, res, () => { nextCalled = true; });

    assert.strictEqual(headers['Cache-Control'], 'no-store', 'Should set no-store');
    assert.strictEqual(nextCalled, true, 'Should call next');
}

console.log('✅ httpCache self-check: all assertions passed');
