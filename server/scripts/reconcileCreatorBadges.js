/**
 * Reconcile User.verificationBadge with the BrandProfile that should back it.
 *
 * The badge and the profile are stored independently and had drifted in BOTH
 * directions:
 *
 *   A) badge but NO profile (26 accounts)
 *      Purely seed artifacts - `verificationBadge` is never granted at runtime,
 *      only by seedAll.js. These users showed a verified tick with nothing
 *      behind it, and /create/creator used to refuse to let them make one.
 *      -> badge reset to 'none'
 *
 *   B) profile but NO badge (2 accounts)
 *      The damaging direction. Creating a brand did not set the badge, and the
 *      badge is what every creator feature checks - the "+" button's Create
 *      Post, the Brand section of the dashboard sidebar. So a real creator had
 *      a profile they could not post to.
 *      -> badge granted from the profile's type
 *
 * The root cause of (B) is fixed in brandService.updateProfile, which now sets
 * the badge whenever a profile is created or updated. This script repairs the
 * accounts that predate that fix.
 *
 * Usage:
 *   node server/scripts/reconcileCreatorBadges.js            # preview
 *   node server/scripts/reconcileCreatorBadges.js --apply    # write
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const apply = process.argv.includes('--apply');

const CREATOR_BADGES = ['brand', 'band', 'organizer'];
const BADGE_BY_TYPE = { band: 'band', organizer: 'organizer' };
const badgeForBrandType = type => BADGE_BY_TYPE[String(type || '').toLowerCase()] || 'brand';

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(apply ? '=== APPLYING ===\n' : '=== DRY RUN (nothing written) ===\n');

    const User = require('../models/User');
    const BrandProfile = require('../models/BrandProfile');

    // Load every profile once and index by user id - avoids an exists() query
    // per user, which mattered at 140 users and will matter more later.
    const profiles = await BrandProfile.find({}).select('user type name').lean();
    const profileByUser = new Map(profiles.map(p => [String(p.user), p]));

    /* ---- A) badge with no profile -> clear ---- */
    const badged = await User.find({ verificationBadge: { $in: CREATOR_BADGES } })
        .select('email verificationBadge')
        .lean();

    const toClear = badged.filter(u => !profileByUser.has(String(u._id)));
    console.log(`A) Badge but NO brand profile: ${toClear.length}`);
    toClear.slice(0, 6).forEach(u =>
        console.log(`   ${u.email.padEnd(34)} ${u.verificationBadge} -> none`)
    );
    if (toClear.length > 6) console.log(`   ... and ${toClear.length - 6} more`);

    if (apply && toClear.length) {
        const r = await User.updateMany(
            { _id: { $in: toClear.map(u => u._id) } },
            { $set: { verificationBadge: 'none' } }
        );
        console.log(`   -> cleared ${r.modifiedCount}`);
    }

    /* ---- B) profile with no badge -> grant ---- */
    console.log(`\nB) Brand profile but NO badge:`);
    let granted = 0;
    for (const p of profiles) {
        const user = await User.findById(p.user).select('email verificationBadge').lean();
        if (!user) continue;                                   // orphaned profile
        if (CREATOR_BADGES.includes(user.verificationBadge)) continue;

        const badge = badgeForBrandType(p.type);
        granted++;
        console.log(`   ${user.email.padEnd(34)} ${user.verificationBadge} -> ${badge}   (${p.name}, ${p.type})`);

        if (apply) {
            await User.updateOne({ _id: p.user }, { $set: { verificationBadge: badge } });
        }
    }
    if (granted === 0) console.log('   none');
    console.log(`   ${granted} account(s) ${apply ? 'granted' : 'would be granted'} a badge`);

    console.log(apply
        ? '\nDone. Badges and profiles are now consistent.'
        : '\nRe-run with --apply to write these changes.');
}

main()
    .catch(err => console.error('\nFailed:', err.message))
    .finally(() => mongoose.disconnect());
