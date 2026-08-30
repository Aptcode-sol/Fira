// @ts-check

/**
 * Escape a user-supplied string before it is used inside a RegExp.
 *
 * Search terms come straight off the query string. Unescaped, a value like "a("
 * throws (500s the listing) and a pathological pattern can be made to burn CPU on
 * every request. eventService had this guard; the admin dashboard's user, venue and
 * event searches did not, so one bracket typed into an admin search box broke the
 * page. It lives here now so there is one copy for every caller.
 */
function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
