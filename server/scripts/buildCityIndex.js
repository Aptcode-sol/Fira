/**
 * Regenerate server/data/indiaCities.json - the local city index.
 *
 * Why a local file at all: the city picker used to call a geocoder on every
 * keystroke. From India that round trip ran into seconds, and when it exceeded
 * the timeout the circuit breaker opened and the picker told people their city
 * did not exist. A city-to-state mapping is fixed reference data, so paying
 * network latency to look it up buys nothing - the file answers in under a
 * millisecond and cannot be down.
 *
 * The geocoder stays as the long tail: villages and hamlets that no compact list
 * contains still resolve, they just cost a request.
 *
 * Sources (public city/state listings, merged and de-duplicated):
 *   https://github.com/nshntarora/Indian-Cities-JSON
 *   https://github.com/thatisuday/indian-cities-database
 *
 * Usage: node server/scripts/buildCityIndex.js
 * Only needs re-running to widen coverage; the output is committed.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const { citySlug, canonicalCityName } = require('../utils/citySlug');

const SOURCES = [
    { url: 'https://raw.githubusercontent.com/nshntarora/Indian-Cities-JSON/master/cities.json', city: 'name' },
    { url: 'https://raw.githubusercontent.com/thatisuday/indian-cities-database/master/cities.json', city: 'city' },
];

const OUT = path.join(__dirname, '..', 'data', 'indiaCities.json');

async function main() {
    /** @type {Map<string, [string, string]>} slug|state -> [name, state] */
    const bySlugState = new Map();

    for (const source of SOURCES) {
        const { data } = await axios.get(source.url, { timeout: 30000 });
        let added = 0;
        for (const row of data || []) {
            const rawName = row[source.city];
            const state = String(row.state || '').trim();
            if (!rawName || !state) continue;

            // Canonicalised on the way in, so the file cannot disagree with what
            // the write path stores. Bengaluru becomes Bangalore here too.
            const name = canonicalCityName(rawName);
            const slug = citySlug(name);
            if (!slug) continue;

            // Keyed with the state: there is a Vellore in Tamil Nadu and one in
            // Andhra Pradesh, and they are different places.
            const key = `${slug}|${state}`;
            if (bySlugState.has(key)) continue;
            bySlugState.set(key, [name, state]);
            added++;
        }
        console.log(`${source.url.split('/').slice(-2).join('/')}: +${added}`);
    }

    // Sorted by name so the file diffs cleanly when a source adds a city.
    const rows = Array.from(bySlugState.values()).sort((a, b) => a[0].localeCompare(b[0]));

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    // [name, state] pairs rather than objects: same data, roughly half the bytes,
    // and this file is read into memory on every server boot.
    fs.writeFileSync(OUT, JSON.stringify(rows));

    console.log(`\n${rows.length} cities -> ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
