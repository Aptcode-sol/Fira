/**
 * Reconcile User.verificationBadge with the BrandProfile that should back it.
 *
 * One rule, matching the runtime code: an account carries a creator badge if and
 * only if it has a BrandProfile with `status: 'approved'`. adminService is the only
 * place that moves that status, so the badge follows the admin's decision and
 * nothing else.
 *
 * Three drifts to repair:
 *
 *   A) badge but NO profile
 *      Seed artifacts. A verified tick with nothing behind it.
 *      -> badge reset to 'none'
 *
 *   B) approved profile but NO badge
 *      A real, admin-approved creator whose badge never got set - and the badge is
 *      what every creator feature checks (the "+" button's Create Post, the creator
 *      dashboard). So they had a profile they could not post from.
 *      -> badge granted from the profile's type
 *
 *   C) badge but the profile is NOT approved
 *      The damaging direction, and the reason this script was rewritten.
 *      brandService.updateProfile used to grant the badge on every profile save, so
 *      submitting an application was enough to be shown as a "Verified Creator"
 *      while the admin queue decided nothing. Every account that applied before that
 *      fix is in this state.
 *      -> badge cleared; they go back to "Applied" until an admin approves
 *
 * Section B used to grant a badge to ANY profile missing one, with no regard for
 * status. Running that version now would re-create (C) on every pending applicant.
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

const preview = (rows, limit = 6) => {
    rows.slice(0, limit).forEach(line => console.log(`   ${line}`));
    if (rows.length > limit) console.log(`   ... and ${rows.length - limit} more`);
    if (rows.length === 0) console.log('   none');
};

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(apply ? '=== APPLYING ===\n' : '=== DRY RUN (nothing written) ===\n');

    const User = require('../models/User');
    const BrandProfile = require('../models/BrandProfile');

    // Load both sides once and join in memory - one query each instead of one per
    // account, which mattered at 140 users and will matter more later.
    const profiles = await BrandProfile.find({}).select('user type name status').lean();
    const profileByUser = new Map(profiles.map(p => [String(p.user), p]));

    const users = await User.find({}).select('email verificationBadge').lean();

    const clear = [];   // ids whose badge must go
    const grant = [];   // { _id, badge }

    for (const u of users) {
        const p = profileByUser.get(String(u._id));
        const badged = CREATOR_BADGES.includes(u.verificationBadge);
        const approved = p?.status === 'approved';

        if (badged && !approved) clear.push({ ...u, profile: p });
        if (!badged && approved) grant.push({ ...u, profile: p, badge: badgeForBrandType(p.type) });
    }

    const noProfile = clear.filter(u => !u.profile);
    const notApproved = clear.filter(u => u.profile);

    console.log(`A) Badge but NO brand profile: ${noProfile.length}`);
    preview(noProfile.map(u => `${u.email.padEnd(34)} ${u.verificationBadge} -> none`));

    console.log(`\nB) Approved profile but NO badge: ${grant.length}`);
    preview(grant.map(u => `${u.email.padEnd(34)} ${u.verificationBadge} -> ${u.badge}   (${u.profile.name}, ${u.profile.type})`));

    console.log(`\nC) Badge but profile NOT approved: ${notApproved.length}`);
    preview(notApproved.map(u => `${u.email.padEnd(34)} ${u.verificationBadge} -> none   (${u.profile.name}, status=${u.profile.status})`));

    if (apply) {
        if (clear.length) {
            const r = await User.updateMany(
                { _id: { $in: clear.map(u => u._id) } },
                { $set: { verificationBadge: 'none', isVerified: false } }
            );
            console.log(`\n-> cleared ${r.modifiedCount} badge(s)`);
        }
        // Grouped by target badge so this stays three updateMany calls rather than
        // one write per account.
        for (const badge of CREATOR_BADGES) {
            const ids = grant.filter(u => u.badge === badge).map(u => u._id);
            if (!ids.length) continue;
            const r = await User.updateMany(
                { _id: { $in: ids } },
                { $set: { verificationBadge: badge, isVerified: true } }
            );
            console.log(`-> granted ${r.modifiedCount} '${badge}' badge(s)`);
        }
    }

    console.log(apply
        ? '\nDone. A creator badge now means exactly "has an approved brand profile".'
        : '\nRe-run with --apply to write these changes.');
}

main()
    .catch(err => console.error('\nFailed:', err.message))
    .finally(() => mongoose.disconnect());
