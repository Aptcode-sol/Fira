/**
 * The tier name a ticket carries when its event defines no tiers.
 *
 * A tier is compulsory at event creation now, so new events always name one. This
 * only covers events created before that, whose tickets were issued under this name
 * by `purchaseTicket`'s default. Their scanner link is scoped to it so it matches
 * what those tickets actually say - without this they would have no working door.
 *
 * Shared so the purchase path and the scanner provisioning cannot drift: if these two
 * disagreed, a legacy event's link would admit nobody.
 */
const PURCHASE_FALLBACK_TIER = 'general';

module.exports = { PURCHASE_FALLBACK_TIER };
