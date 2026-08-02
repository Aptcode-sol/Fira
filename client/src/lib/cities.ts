/**
 * Canonical city list for the city-first experience.
 *
 * These drive three things at once:
 *   1. The default city applied to the events/venues listings.
 *   2. The /events/in/<city> and /venues/in/<city> landing pages.
 *   3. The sitemap entries for those pages.
 *
 * `name` must match the spelling stored in `address.city` on venues, because
 * that is what the API filters on. `slug` is the URL form.
 */
export interface City {
    slug: string;
    /** Value sent to the API and shown in the UI. */
    name: string;
    /** State, used in metadata copy to disambiguate for search engines. */
    state: string;
    /** Extra spellings people search for, matched when resolving a slug. */
    aliases?: string[];
}

export const CITIES: City[] = [
    { slug: 'mumbai', name: 'Mumbai', state: 'Maharashtra', aliases: ['bombay'] },
    { slug: 'delhi', name: 'Delhi', state: 'Delhi', aliases: ['new-delhi', 'ncr'] },
    { slug: 'bangalore', name: 'Bangalore', state: 'Karnataka', aliases: ['bengaluru'] },
    { slug: 'hyderabad', name: 'Hyderabad', state: 'Telangana' },
    { slug: 'chennai', name: 'Chennai', state: 'Tamil Nadu', aliases: ['madras'] },
    { slug: 'kolkata', name: 'Kolkata', state: 'West Bengal', aliases: ['calcutta'] },
    { slug: 'pune', name: 'Pune', state: 'Maharashtra' },
    { slug: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat' },
    { slug: 'jaipur', name: 'Jaipur', state: 'Rajasthan' },
    { slug: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh' },
    { slug: 'chandigarh', name: 'Chandigarh', state: 'Chandigarh' },
    { slug: 'goa', name: 'Goa', state: 'Goa' },
    { slug: 'kochi', name: 'Kochi', state: 'Kerala', aliases: ['cochin'] },
    { slug: 'indore', name: 'Indore', state: 'Madhya Pradesh' },
    { slug: 'nagpur', name: 'Nagpur', state: 'Maharashtra' },
];

/** Cities linked from the footer / city switcher. Ordered by expected demand. */
export const FEATURED_CITY_SLUGS = [
    'mumbai',
    'delhi',
    'bangalore',
    'hyderabad',
    'pune',
    'chennai',
    'goa',
    'kolkata',
];

export function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/** Resolve a URL slug (or an alias) to a known city. */
export function getCityBySlug(slug: string): City | undefined {
    const normalized = slugify(slug);
    return CITIES.find(
        city => city.slug === normalized || city.aliases?.includes(normalized)
    );
}

/** Resolve a stored city name (e.g. a user's profile city) to a known city. */
export function getCityByName(name?: string | null): City | undefined {
    if (!name) return undefined;
    const normalized = slugify(name);
    return CITIES.find(
        city => city.slug === normalized || city.aliases?.includes(normalized)
    );
}

export const FEATURED_CITIES = FEATURED_CITY_SLUGS
    .map(slug => CITIES.find(c => c.slug === slug))
    .filter((c): c is City => Boolean(c));

/**
 * Every city offered in the signup "City" picker.
 *
 * Separate from CITIES on purpose. CITIES drives the /events/in/<city> and
 * /venues/in/<city> landing pages, which only make sense where we actually have
 * listings - generating 100+ near-empty pages would be thin content and hurt
 * the site in search. This list, by contrast, should be broad: a new user in
 * Coimbatore or Guwahati must be able to pick their own city at signup.
 *
 * All state capitals, union territory capitals and major metros, alphabetical.
 */
export const SIGNUP_CITIES: string[] = [
    'Agartala', 'Agra', 'Ahmedabad', 'Aizawl', 'Ajmer', 'Aligarh', 'Allahabad (Prayagraj)',
    'Amravati', 'Amritsar', 'Aurangabad', 'Bareilly', 'Belgaum', 'Bengaluru', 'Bhavnagar',
    'Bhopal', 'Bhubaneswar', 'Bikaner', 'Bilaspur', 'Chandigarh', 'Chennai', 'Coimbatore',
    'Cuttack', 'Dehradun', 'Delhi', 'Dhanbad', 'Dispur', 'Durgapur', 'Erode', 'Faridabad',
    'Gandhinagar', 'Gangtok', 'Ghaziabad', 'Goa (Panaji)', 'Gorakhpur', 'Guntur', 'Gurugram',
    'Guwahati', 'Gwalior', 'Howrah', 'Hubli-Dharwad', 'Hyderabad', 'Imphal', 'Indore',
    'Itanagar', 'Jabalpur', 'Jaipur', 'Jalandhar', 'Jammu', 'Jamshedpur', 'Jodhpur',
    'Kakinada', 'Kanpur', 'Kavaratti', 'Kochi', 'Kohima', 'Kolhapur', 'Kolkata', 'Kollam',
    'Kota', 'Kozhikode', 'Kurnool', 'Lucknow', 'Ludhiana', 'Madurai', 'Mangaluru', 'Meerut',
    'Mumbai', 'Mysuru', 'Nagpur', 'Nashik', 'Navi Mumbai', 'Nellore', 'Noida', 'Patna',
    'Puducherry', 'Pune', 'Raipur', 'Rajahmundry', 'Rajkot', 'Ranchi', 'Rourkela', 'Salem',
    'Sangli', 'Shillong', 'Shimla', 'Siliguri', 'Solapur', 'Srinagar', 'Surat', 'Thane',
    'Thiruvananthapuram', 'Thrissur', 'Tiruchirappalli', 'Tirunelveli', 'Tirupati',
    'Udaipur', 'Ujjain', 'Vadodara', 'Varanasi', 'Vijayawada', 'Visakhapatnam', 'Warangal',
];
