// Run: node src/app/terms/anchors.check.mjs   (from client/)
//
// The retired /privacy, /refund-policy and /community-guidelines URLs redirect to
// anchors inside the Terms page. Nothing at build time links the redirect
// destination to the section id, so a renamed section would turn those redirects
// into a silent scroll-to-top - the visitor lands on a 60-section legal document
// with no idea which part answered their question, and the payment gateway's
// registered privacy/refund URLs stop pointing at the policy.
//
// This asserts every `/terms#id` destination has a matching `id="id"` section.

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = readFileSync(path.join(here, '../../../next.config.ts'), 'utf8');
const termsPage = readFileSync(path.join(here, 'page.tsx'), 'utf8');

const anchors = [...config.matchAll(/destination:\s*'\/terms#([\w-]+)'/g)].map((m) => m[1]);
const ids = new Set([...termsPage.matchAll(/<section id="([\w-]+)"/g)].map((m) => m[1]));

assert.ok(anchors.length >= 3, `expected the three retired policy redirects, found ${anchors.length}`);

for (const anchor of anchors) {
    assert.ok(ids.has(anchor), `next.config.ts redirects to /terms#${anchor}, but no <section id="${anchor}"> exists in terms/page.tsx`);
}

console.log(`OK - ${anchors.length} terms anchors resolve: ${anchors.join(', ')}`);
