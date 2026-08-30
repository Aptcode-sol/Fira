// @ts-check
'use strict';

const axios = require('axios');
const Venue = require('../models/Venue');
const Event = require('../models/Event');
const { citySlug, canonicalCityName } = require('../utils/citySlug');
const { createCircuitBreaker } = require('../lib/circuitBreaker');

/**
 * City lookup for the address forms.
 *
 * Every address form used to pick from a hand-maintained list of ~100 cities,
 * which meant a venue owner in Vellore or Panipat simply could not list. This
 * proxies a geocoder instead, so coverage is every town the provider knows.
 *
 * The call goes through the server, not the browser, for three reasons: the API
 * key stays out of client JS, one cache serves every user, and the provider can
 * be swapped without shipping a new frontend.
 */

/**
 * Local city index: 1,687 Indian cities and towns as [name, state] pairs.
 *
 * Answers in well under a millisecond and cannot be unreachable, which is why it
 * runs before any network call. A geocoder round trip from India was taking long
 * enough to trip the 4s timeout, which opened the circuit breaker and left the
 * picker telling people their city did not exist.
 *
 * Regenerate with `node server/scripts/buildCityIndex.js`.
 */
const CITY_ROWS = require('../data/indiaCities.json');

/** Pre-computed once at boot: [lowercased name, name, state, slug]. */
const CITY_INDEX = CITY_ROWS.map(([name, state]) => [
    name.toLowerCase(),
    name,
    state,
    citySlug(name),
]);

const GEOAPIFY_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';

/**
 * Keyless fallback provider (Komoot's public Photon, OpenStreetMap data).
 *
 * Used when GEOAPIFY_API_KEY is absent, so the address forms work on a fresh
 * clone with no accounts to set up. The public instance carries no SLA and asks
 * for polite use, which is why the keyed provider wins when configured and why
 * the cache in this file matters.
 */
const PHOTON_URL = 'https://photon.komoot.io/api';

/**
 * Warm provider calls land around 600-900ms. The ceiling is set well above that
 * for the first call after a boot, which pays DNS and a TLS handshake on top -
 * that cold call was exceeding a 4s limit, tripping the breaker and telling the
 * user their city did not exist. Only the long tail waits this long; anything in
 * the local index answers before a request is made.
 */
const REQUEST_TIMEOUT_MS = 8000;

/** Shortest query worth spending a provider call on. */
const MIN_QUERY_LENGTH = 2;

const MAX_RESULTS = 8;

/**
 * Query -> results cache.
 *
 * Autocomplete traffic is extremely repetitive: everyone types "mum", "del",
 * "ban". Caching by query prefix turns most keystrokes into zero provider
 * calls, which is the difference between a free tier that lasts and one that
 * does not.
 *
 * ponytail: a plain Map, so it is per-process and lost on restart. Ceiling is
 * one cache per PM2 worker; if that stops being good enough, the upgrade is the
 * Redis client already configured in config/redis.js, same key shape.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;
/** @type {Map<string, { at: number, results: any[] }>} */
const cache = new Map();

function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    // Refresh insertion order so the eviction below drops genuinely cold keys
    // rather than merely old ones.
    cache.delete(key);
    cache.set(key, hit);
    return hit.results;
}

function cacheSet(key, results) {
    if (cache.size >= CACHE_MAX_ENTRIES) {
        // Map preserves insertion order, so the first key is the least recently used.
        cache.delete(cache.keys().next().value);
    }
    cache.set(key, { at: Date.now(), results });
}

/**
 * Normalise one provider result into the only four fields we care about.
 *
 * Returns null for anything without a usable city and state. A half-filled
 * suggestion is worse than no suggestion: the user picks it, the State field
 * stays empty, and the form blocks on a field they cannot see how to fill.
 *
 * @param {any} raw
 */
function normalize(raw) {
    if (!raw) return null;
    // Geoapify names the city in `city` for cities and in `name` for smaller
    // places, so fall through rather than trusting one field.
    const name = raw.city || raw.town || raw.village || raw.name;
    const state = raw.state || raw.county;
    if (!name || !state) return null;

    const city = canonicalCityName(name);
    const slug = citySlug(name);
    if (!slug) return null;

    return {
        city,
        slug,
        state: String(state).trim(),
        // Kept so a later "venues near me" feature does not need a second
        // provider round trip per address. Null when the provider omits them.
        lat: typeof raw.lat === 'number' ? raw.lat : null,
        lng: typeof raw.lon === 'number' ? raw.lon : null,
    };
}

/**
 * De-duplicate and cap. Both providers return a row per administrative level, so
 * one city arrives several times; the slug is what collapses them.
 * @param {any[]} rows already in normalize()'s input shape
 */
function collect(rows) {
    const seen = new Set();
    const results = [];
    for (const raw of rows) {
        const item = normalize(raw);
        if (!item) continue;
        // Keyed on slug AND state, not slug alone: there is a Vellore in Tamil
        // Nadu and a Vellore in Andhra Pradesh, and collapsing them would offer
        // one of them the wrong state.
        //
        // ponytail: two same-named towns still share one citySlug, so they share a
        // city page and a filter bucket. Fine while that is a handful of villages;
        // the upgrade is a state-qualified slug (vellore-ap) once it matters.
        const key = `${item.slug}|${item.state}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(item);
        if (results.length >= MAX_RESULTS) break;
    }
    return results;
}

/** @param {string} query */
async function fetchFromGeoapify(query) {
    const { data } = await axios.get(GEOAPIFY_URL, {
        timeout: REQUEST_TIMEOUT_MS,
        params: {
            text: query,
            // City-level results only. Without this a street name in Chennai
            // comes back as a "city" and ends up stored as one.
            type: 'city',
            filter: 'countrycode:in',
            format: 'json',
            limit: MAX_RESULTS * 3, // over-fetch: collect() drops the unusable ones
            apiKey: process.env.GEOAPIFY_API_KEY,
        },
    });
    return collect(data?.results || []);
}

/** Place types that are a "city" for our purposes - a venue can sit in any of them. */
const PHOTON_PLACE_TYPES = new Set(['city', 'town', 'village', 'municipality', 'suburb']);

/** @param {string} query */
async function fetchFromPhoton(query) {
    const { data } = await axios.get(PHOTON_URL, {
        timeout: REQUEST_TIMEOUT_MS,
        params: { q: query, lang: 'en', limit: MAX_RESULTS * 4 },
    });

    const rows = (data?.features || [])
        .map((f) => ({ ...f.properties, coordinates: f.geometry?.coordinates }))
        // Photon has no country filter parameter, so India is filtered here. It
        // also returns streets and shops for a plain query, hence the place check.
        .filter((p) => p.countrycode === 'IN' && p.osm_key === 'place' && PHOTON_PLACE_TYPES.has(p.osm_value))
        .map((p) => ({
            name: p.name,
            state: p.state,
            county: p.county,
            // Photon puts coordinates in the geometry, not the properties.
            lat: Array.isArray(p.coordinates) ? p.coordinates[1] : null,
            lon: Array.isArray(p.coordinates) ? p.coordinates[0] : null,
        }));

    return collect(rows);
}

/**
 * One provider call. Wrapped in a breaker below, so this stays the happy path.
 * @param {string} query
 */
async function fetchFromProvider(query) {
    return process.env.GEOAPIFY_API_KEY
        ? fetchFromGeoapify(query)
        : fetchFromPhoton(query);
}

// 5 failures in a 60s window opens the circuit, then probe every 30s. Matches
// the other third-party breakers in lib/circuitBreaker.js.
const providerBreaker = createCircuitBreaker('Geocoder', fetchFromProvider, {
    volumeThreshold: 5,
    rollingCountTimeout: 60_000,
    resetTimeout: 30_000,
    timeout: REQUEST_TIMEOUT_MS + 500,
});

/**
 * Search the local index. Synchronous, no network, no failure mode.
 *
 * Ranked so a prefix beats a substring: typing "del" must put Delhi first, not
 * New Delhi Municipal or Kundeli. Within a rank, shorter names win, because the
 * shorter one is the place someone typing three letters almost always means.
 *
 * @param {string} query
 */
function searchLocal(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    /** @type {Array<{ row: any[], rank: number }>} */
    const hits = [];
    for (const row of CITY_INDEX) {
        const lower = row[0];
        const rank = lower === q ? 0 : lower.startsWith(q) ? 1 : lower.includes(q) ? 2 : -1;
        if (rank === -1) continue;
        hits.push({ row, rank });
    }

    hits.sort((a, b) => a.rank - b.rank || a.row[0].length - b.row[0].length);

    return hits.slice(0, MAX_RESULTS).map(({ row }) => ({
        city: row[1],
        slug: row[3],
        state: row[2],
        // The index carries no coordinates. Nothing reads them yet, and a venue's
        // maps link is the source of truth for where it actually is.
        lat: null,
        lng: null,
    }));
}

/**
 * Cities that already have listings, matched against a query.
 *
 * Serves two jobs. It is the city filter's option list, and it is the fallback
 * for the picker when the provider is unreachable or unconfigured: a degraded
 * picker that still offers every city we have listings in beats a dead one,
 * and in local development it means the forms work with no API key at all.
 *
 * @param {string} [query]
 */
async function searchListedCities(query) {
    const listed = await listedCities();
    if (!query) return listed.slice(0, MAX_RESULTS);
    const q = query.trim().toLowerCase();
    return listed
        .filter(c => c.city.toLowerCase().includes(q) || c.slug.includes(q))
        .slice(0, MAX_RESULTS);
}

/**
 * City suggestions for a typed query.
 *
 * @param {string} query
 * @returns {Promise<{ results: any[], source: 'local' | 'cache' | 'provider' | 'listings' }>}
 *   `listings` means the provider could not be reached and this is the degraded
 *   answer - the client says so rather than reporting "no such city".
 */
async function searchCities(query) {
    const trimmed = String(query || '').trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return { results: [], source: 'local' };

    // Local first. Covers every city and town anyone is realistically listing in,
    // instantly, so the common case never touches the network.
    const local = searchLocal(trimmed);
    if (local.length) return { results: local, source: 'local' };

    const key = trimmed.toLowerCase();
    const cached = cacheGet(key);
    if (cached) return { results: cached, source: 'cache' };

    // Nothing local: a village, a new spelling, or a typo. Only now is a request
    // worth its latency.
    try {
        const results = await providerBreaker.fire(trimmed);
        // Cache empty results too. A misspelling gets retried a lot, and each
        // retry would otherwise be a paid call returning the same nothing.
        cacheSet(key, results);
        return { results, source: 'provider' };
    } catch (err) {
        // Provider down, over quota, or the circuit is open. The user is midway
        // through creating a venue; offering a shorter list beats losing the form.
        return { results: await searchListedCities(trimmed), source: 'listings' };
    }
}

/**
 * Distinct cities that currently hold at least one live listing, with counts.
 *
 * This is what the city filter and the /events/in/<city> and /venues/in/<city>
 * pages are built from. Generating a page for a city with nothing in it reads
 * as thin content, so "has listings" is the entry condition, not a static list.
 *
 * An event held at a listed venue is in that venue's city, and the venue itself
 * already puts that city in this list - so no join over events is needed to
 * decide whether a city deserves a page.
 */
const LISTED_TTL_MS = 5 * 60 * 1000;
/** @type {{ at: number, value: any[] } | null} */
let listedCache = null;

async function listedCities() {
    if (listedCache && Date.now() - listedCache.at < LISTED_TTL_MS) {
        return listedCache.value;
    }

    const hasSlug = { $nin: [null, ''] };

    const [venueRows, eventRows] = await Promise.all([
        Venue.aggregate([
            { $match: { status: 'approved', isActive: true, 'address.citySlug': hasSlug } },
            {
                $group: {
                    _id: '$address.citySlug',
                    city: { $first: '$address.city' },
                    state: { $first: '$address.state' },
                    venues: { $sum: 1 },
                },
            },
        ]),
        Event.aggregate([
            { $match: { status: 'approved', isActive: true, 'customVenue.citySlug': hasSlug } },
            {
                $group: {
                    _id: '$customVenue.citySlug',
                    city: { $first: '$customVenue.city' },
                    state: { $first: '$customVenue.state' },
                    events: { $sum: 1 },
                },
            },
        ]),
    ]);

    /** @type {Map<string, any>} */
    const bySlug = new Map();
    for (const row of [...venueRows, ...eventRows]) {
        if (!row._id) continue;
        const existing = bySlug.get(row._id);
        if (existing) {
            existing.venues += row.venues || 0;
            existing.events += row.events || 0;
            existing.state = existing.state || row.state || '';
            continue;
        }
        bySlug.set(row._id, {
            slug: row._id,
            city: canonicalCityName(row.city || row._id),
            state: row.state || '',
            venues: row.venues || 0,
            events: row.events || 0,
        });
    }

    const value = Array.from(bySlug.values()).sort((a, b) => a.city.localeCompare(b.city));
    listedCache = { at: Date.now(), value };
    return value;
}

/** Drop the listings cache. Used by tests; also safe to call after a bulk import. */
function clearCaches() {
    cache.clear();
    listedCache = null;
}

module.exports = { searchCities, listedCities, clearCaches, MIN_QUERY_LENGTH };
