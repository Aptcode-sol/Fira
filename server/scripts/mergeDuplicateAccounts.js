/**
 * One-off duplicate-account merge migration (Flow 7).
 *
 * The old single `User.role` enum forced a person who is BOTH a normal user and
 * a venue owner to hold two separate accounts under the same email. Now that
 * `User.roles` is an array, those duplicates collapse into ONE sign-in account
 * carrying both roles (`['user', 'venue_owner']`).
 *
 * What it does, per group of accounts sharing an email (case-insensitive):
 *   - Pick a SURVIVOR. When roles differ, the venue_owner account wins (design
 *     ceiling: owner-critical data — bankDetails, owned venues/events — lives on
 *     the owner account, so keeping it survivor loses the least). Ties broken by
 *     oldest `createdAt`.
 *   - Union every account's roles (and legacy `role`) onto the survivor's
 *     `roles` array. Keep the survivor's legacy `role` as its primary.
 *   - Repoint owned Venues (`owner`) and Events (`organizer`) from the
 *     merged-away accounts to the survivor.
 *   - Fill owner-critical fields (bankDetails) on the survivor from a merged-away
 *     account only where the survivor's own value is empty — never overwrite.
 *   - Delete the merged-away accounts.
 *
 * Idempotent + email-keyed: safe to re-run. A single account that already holds
 * the correct union `roles` is skipped, so a second run merges nothing and loses
 * no data.
 *
 * ponytail: this is NOT a general account-merge framework. Single idempotent
 * email-keyed script; conflict handling = keep the owner account as survivor.
 * Upgrade path: add phone-based matching ONLY if email collisions prove
 * insufficient (people who share one email but are genuinely different, or
 * duplicates under different emails). Not needed today.
 *
 * This file is a standalone script. It is NOT imported by any runtime code and
 * does NOT auto-execute on import — the CLI block at the bottom only runs when
 * the file is invoked directly (`require.main === module`).
 *
 * Usage:
 *   node server/scripts/mergeDuplicateAccounts.js               # dry run (default, nothing written)
 *   node server/scripts/mergeDuplicateAccounts.js --apply       # write the merges
 *   node server/scripts/mergeDuplicateAccounts.js --self-check   # in-memory self-check, no real DB
 */

const ROLE_RANK = { admin: 3, venue_owner: 2, user: 1 };

/**
 * Union of an account's roles: the `roles` array plus the legacy `role`,
 * de-duplicated. Empty/unknown values are dropped.
 */
function accountRoles(u) {
    const set = new Set();
    (Array.isArray(u.roles) ? u.roles : []).forEach(r => r && set.add(r));
    if (u.role) set.add(u.role);
    if (set.size === 0) set.add('user');
    return set;
}

/**
 * Choose the survivor of a group: the account with the highest-ranked role
 * (owner beats user), ties broken by oldest createdAt, then _id string for a
 * fully deterministic result.
 */
function pickSurvivor(group) {
    return [...group].sort((a, b) => {
        const ra = Math.max(...[...accountRoles(a)].map(r => ROLE_RANK[r] || 0));
        const rb = Math.max(...[...accountRoles(b)].map(r => ROLE_RANK[r] || 0));
        if (ra !== rb) return rb - ra;                                  // higher role first
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ta !== tb) return ta - tb;                                  // older first
        return String(a._id).localeCompare(String(b._id));             // stable tiebreak
    })[0];
}

/** The union roles the survivor should end up with, in a stable order. */
function mergedRoles(group) {
    const set = new Set();
    for (const u of group) for (const r of accountRoles(u)) set.add(r);
    return ['user', 'venue_owner', 'admin'].filter(r => set.has(r));
}

/**
 * Core merge logic, pure of any CLI/env concerns so it can be driven by both the
 * real DB run and the in-memory self-check. `apply` gates all writes.
 *
 * @returns {Promise<Array>} report rows describing each duplicate group.
 */
async function mergeDuplicateAccounts({ User, Venue, Event, apply = false, log = () => {} }) {
    const users = await User.find({}).select('email role roles bankDetails createdAt').lean();

    // Group by lowercased/trimmed email (schema already lowercases, but stay safe).
    const byEmail = new Map();
    for (const u of users) {
        const key = String(u.email || '').trim().toLowerCase();
        if (!key) continue;
        if (!byEmail.has(key)) byEmail.set(key, []);
        byEmail.get(key).push(u);
    }

    const report = [];

    for (const [email, group] of byEmail) {
        if (group.length === 1) {
            // Idempotency: a lone account is only "done" — nothing to merge.
            // (Its roles were already normalized on a prior run or at creation.)
            continue;
        }

        const survivor = pickSurvivor(group);
        const losers = group.filter(u => String(u._id) !== String(survivor._id));
        const roles = mergedRoles(group);

        // Repoint owned venues/events from every loser to the survivor.
        const loserIds = losers.map(u => u._id);
        const venuesToRepoint = await Venue.countDocuments({ owner: { $in: loserIds } });
        const eventsToRepoint = await Event.countDocuments({ organizer: { $in: loserIds } });

        // Owner-critical fields to lift onto the survivor only where it's empty.
        const survivorHasBank = !!(survivor.bankDetails && survivor.bankDetails.accountNumber);
        const bankSource = survivorHasBank
            ? null
            : losers.find(u => u.bankDetails && u.bankDetails.accountNumber);

        report.push({
            email,
            survivorId: String(survivor._id),
            mergedAway: losers.map(u => String(u._id)),
            roles,
            venuesRepointed: venuesToRepoint,
            eventsRepointed: eventsToRepoint,
            bankLifted: !!bankSource,
        });

        log(`  ${email}`);
        log(`    survivor ${survivor._id} -> roles [${roles.join(', ')}]`);
        log(`    merging away ${losers.length} account(s); repoint ${venuesToRepoint} venue(s), ${eventsToRepoint} event(s)` +
            (bankSource ? '; lifting bankDetails to survivor' : ''));

        if (!apply) continue;

        // --- writes (fail-loud: any throw aborts before deleting an account) ---
        if (loserIds.length) {
            await Venue.updateMany({ owner: { $in: loserIds } }, { $set: { owner: survivor._id } });
            await Event.updateMany({ organizer: { $in: loserIds } }, { $set: { organizer: survivor._id } });
        }

        const set = { roles };
        if (bankSource) set.bankDetails = bankSource.bankDetails;
        await User.updateOne({ _id: survivor._id }, { $set: set });

        if (loserIds.length) {
            await User.deleteMany({ _id: { $in: loserIds } });
        }
    }

    return report;
}

module.exports = { mergeDuplicateAccounts, pickSurvivor, mergedRoles, accountRoles };

/* -------------------------------------------------------------------------- */
/* CLI — only runs when invoked directly, never on import.                    */
/* -------------------------------------------------------------------------- */
if (require.main === module) {
    const path = require('path');
    const apply = process.argv.includes('--apply');
    const selfCheck = process.argv.includes('--self-check');

    if (selfCheck) {
        // Delegate to the standalone self-check (no real DB).
        require('./mergeDuplicateAccounts.check.mjs');
    } else {
        require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
        const mongoose = require('mongoose');

        (async () => {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log(apply ? '=== APPLYING ===\n' : '=== DRY RUN (nothing written) ===\n');
            const User = require('../models/User');
            const Venue = require('../models/Venue');
            const Event = require('../models/Event');

            const report = await mergeDuplicateAccounts({ User, Venue, Event, apply, log: console.log });

            if (report.length === 0) {
                console.log('No duplicate-account groups found. Nothing to merge.');
            } else {
                console.log(`\n${report.length} duplicate group(s) ${apply ? 'merged' : 'would be merged'}.`);
            }
            console.log(apply ? '\nDone.' : '\nRe-run with --apply to write these changes.');
        })()
            .catch(err => console.error('\nFailed:', err.message))
            .finally(() => mongoose.disconnect());
    }
}
