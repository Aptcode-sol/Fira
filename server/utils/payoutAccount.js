const User = require('../models/User');

/**
 * Keep only a payoutAccount id that genuinely belongs to the given user.
 *
 * `payoutAccount` arrives from the client on venue/event create, and the create
 * routes use zod `.passthrough()`, so an arbitrary ObjectId would otherwise be
 * stored as-is. Payout resolution already looks the id up *inside the owner's own*
 * bankAccounts, so a foreign id could never redirect money - but persisting one
 * would leave a listing pointing at nothing, silently paying to the default
 * forever. Rejecting it here means the stored value is always meaningful.
 *
 * Returns the id when it matches one of the user's accounts, otherwise null (which
 * the payout path reads as "use my default").
 */
async function sanitizePayoutAccount(userId, payoutAccountId) {
    if (!userId || !payoutAccountId) return null;

    const user = await User.findById(userId).select('bankAccounts');
    if (!user || !Array.isArray(user.bankAccounts)) return null;

    const owns = user.bankAccounts.some(a => String(a._id) === String(payoutAccountId));
    return owns ? payoutAccountId : null;
}

module.exports = { sanitizePayoutAccount };
