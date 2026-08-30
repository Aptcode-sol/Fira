// @ts-check
'use strict';

/**
 * Canonical city slugs - the join key for every city-scoped query and URL.
 *
 * Why a slug and not the city name: from launch, city names arrive from a
 * geocoding provider, and providers disagree with each other and with
 * themselves over time (Bengaluru/Bangalore, Panaji/Goa, Gurgaon/Gurugram).
 * Matching listings on the display string means one city silently splits into
 * two buckets that no filter can join, and /venues/in/bangalore goes empty the
 * day the provider starts saying Bengaluru.
 *
 * So the display name stays whatever the provider (or the owner) called it, and
 * everything that has to *match* - filters, landing pages, sitemap - uses the
 * slug. A provider swap then cannot orphan existing listings.
 */

/**
 * Alias slug -> canonical slug.
 *
 * Renames, colloquial names and administrative splits that all mean one city to
 * someone looking for a venue. Keys and values are already slug-shaped.
 */
const ALIASES = {
    // Official renames. Providers return both spellings depending on dataset age.
    'bengaluru': 'bangalore',
    'bombay': 'mumbai',
    'madras': 'chennai',
    'calcutta': 'kolkata',
    'poona': 'pune',
    'baroda': 'vadodara',
    'cochin': 'kochi',
    'calicut': 'kozhikode',
    'trivandrum': 'thiruvananthapuram',
    'mysore': 'mysuru',
    'mangalore': 'mangaluru',
    'gurgaon': 'gurugram',
    'pondicherry': 'puducherry',
    'prayagraj': 'allahabad',
    'allahabad-prayagraj': 'allahabad',
    // The geocoder returns the current official name, while the local index and
    // existing listings say Rajahmundry. Without this they are two city pages
    // splitting one city's venues.
    'rajamahendravaram': 'rajahmundry',
    'benares': 'varanasi',
    'banaras': 'varanasi',
    'simla': 'shimla',
    'gauhati': 'guwahati',
    // Common abbreviations people type into a search box.
    'vizag': 'visakhapatnam',
    'trichy': 'tiruchirappalli',
    // Administrative names that are not how anyone searches for the place. Goa's
    // districts and Delhi's sub-areas would otherwise each become their own
    // city bucket holding a fraction of the listings.
    'new-delhi': 'delhi',
    'ncr': 'delhi',
    'panaji': 'goa',
    'panjim': 'goa',
    'north-goa': 'goa',
    'south-goa': 'goa',
};

/**
 * Canonical slug -> the spelling we store and show.
 *
 * Only the cities where we have an opinion. Anything absent keeps whatever the
 * provider returned, which is the honest default for a town we have never seen.
 */
const CANONICAL_NAMES = {
    'mumbai': 'Mumbai',
    'delhi': 'Delhi',
    'bangalore': 'Bangalore',
    'hyderabad': 'Hyderabad',
    'chennai': 'Chennai',
    'kolkata': 'Kolkata',
    'pune': 'Pune',
    'ahmedabad': 'Ahmedabad',
    'jaipur': 'Jaipur',
    'lucknow': 'Lucknow',
    'chandigarh': 'Chandigarh',
    'goa': 'Goa',
    'kochi': 'Kochi',
    'indore': 'Indore',
    'nagpur': 'Nagpur',
    'gurugram': 'Gurugram',
    'mysuru': 'Mysuru',
    'mangaluru': 'Mangaluru',
    'kozhikode': 'Kozhikode',
    'thiruvananthapuram': 'Thiruvananthapuram',
    'vadodara': 'Vadodara',
    'varanasi': 'Varanasi',
    'visakhapatnam': 'Visakhapatnam',
    'tiruchirappalli': 'Tiruchirappalli',
    'puducherry': 'Puducherry',
    'allahabad': 'Prayagraj',
};

/**
 * Slug form of any place name: lowercase, ASCII-ish, hyphen separated.
 *
 * Strips diacritics first so "Puducherry" and "Pondichéry" do not become two
 * cities. Must stay identical to the client's slugify, or a URL built in the
 * browser will not match what the database stored.
 *
 * @param {string} value
 * @returns {string}
 */
function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * The canonical slug for a city name, following aliases.
 *
 * @param {string} name
 * @returns {string} '' when the name is empty, so callers can treat "no city"
 *   and "unknown city" the same way rather than storing a slug of "-".
 */
function citySlug(name) {
    const slug = slugify(name);
    return ALIASES[slug] || slug;
}

/**
 * The spelling to store for a city name.
 *
 * Collapses provider variance for the cities we have an opinion on, so listings
 * saved months apart still read the same in the UI. Falls through to a trimmed
 * version of the given name for everywhere else.
 *
 * @param {string} name
 * @returns {string}
 */
function canonicalCityName(name) {
    return CANONICAL_NAMES[citySlug(name)] || String(name || '').trim();
}

module.exports = { slugify, citySlug, canonicalCityName, ALIASES, CANONICAL_NAMES };
