/**
 * Runnable check for the city publishability guard.
 * Run: node src/lib/seo/listedCities.check.mjs
 *
 * The rule has to hold in both directions, and the failure modes are opposite:
 * too loose and the sitemap promises /events/in/a, which 404s on every crawl; too
 * strict and a real small city loses its landing page, which is real traffic.
 *
 * The rejected names are all values this list actually carried at some point - 'a',
 * 'haiene', 'narasa' were live in sitemap.xml and every one of them 404s now.
 *
 * ponytail: the rule is duplicated here as a small copy rather than imported, because
 * listedCities.ts is TypeScript and this runs under bare `node`. Kept to the exact
 * shape of the original so a change to one is visible as a divergence in the other -
 * the assertions below are the specification either way.
 */
import assert from 'node:assert/strict';

function isPublishableCity(city) {
    const name = (city?.city || '').trim();
    const slug = (city?.slug || '').trim();
    if (!name || !slug) return false;
    if (name.length < 3) return false;
    // \p{M} matters: Indic vowels are combining marks, so a letters-only class rejects
    // every Devanagari / Telugu / Tamil spelling of a real city.
    if (!/^[\p{L}][\p{L}\p{M}\s.'-]*$/u.test(name)) return false;
    return (city.venues ?? 0) + (city.events ?? 0) > 0;
}

const city = (name, extra = {}) => ({
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    city: name,
    state: 'Somewhere',
    venues: 1,
    events: 0,
    ...extra,
});

/* ---- must KEEP: real places, including the awkward ones ---- */
for (const name of [
    'Bangalore',
    'Goa',                 // 3 letters - the shortest real one, must not be cut
    'Delhi',
    'Nellore Rural',       // two words
    'Thiruvananthapuram',  // long
    "Bird's Hill",         // apostrophe
    'Navi Mumbai',
    'Puducherry',
    'बंगलौर',              // non-Latin script must not be rejected as noise
]) {
    assert.ok(isPublishableCity(city(name)), `${name} must stay publishable`);
}

/* ---- must REJECT: noise that produced 404s and thin pages ---- */
assert.ok(!isPublishableCity(city('a')), "'a' was a live sitemap entry and 404s");
assert.ok(!isPublishableCity(city('ab')), 'two characters is below any city name');
assert.ok(!isPublishableCity(city('')), 'empty name');
assert.ok(!isPublishableCity({ slug: '', city: 'Mumbai', venues: 1 }), 'no slug = no URL');
assert.ok(!isPublishableCity(city('https://vwver')), 'a pasted URL is not a city');
assert.ok(!isPublishableCity(city('123')), 'digits only');
assert.ok(!isPublishableCity(city('  ')), 'whitespace only');
assert.ok(!isPublishableCity(city('<script>x</script>')), 'markup is not a city');
assert.ok(!isPublishableCity(null), 'null must not throw');
assert.ok(!isPublishableCity(undefined), 'undefined must not throw');

/* ---- an empty city page is not worth a URL ---- */
assert.ok(
    !isPublishableCity(city('Chennai', { venues: 0, events: 0 })),
    'a city with no listings renders an empty page'
);
assert.ok(
    isPublishableCity(city('Chennai', { venues: 0, events: 2 })),
    'events alone are enough to justify the page'
);
assert.ok(
    isPublishableCity(city('Chennai', { venues: 3, events: 0 })),
    'venues alone are enough to justify the page'
);
// Missing counters must not be read as "has listings".
assert.ok(
    !isPublishableCity({ slug: 'chennai', city: 'Chennai' }),
    'absent counts must not default to publishable'
);

console.log('listedCities.check.mjs: all assertions passed');
