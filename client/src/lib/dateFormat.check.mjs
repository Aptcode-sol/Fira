// Runnable check for the dd/mm/yyyy conversions.
//
// The dangerous case is a day that does not exist in its month: Date rolls 31/02 over
// to 2 March, so without the round-trip guard the field would show one date and store
// another. Run: node client/src/lib/dateFormat.check.mjs

import assert from 'node:assert/strict';

function isoToDisplay(iso) {
    if (!iso) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!match) return '';
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
}

function displayToIso(display) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(display.trim());
    if (!match) return '';
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    const asDate = new Date(Date.UTC(year, month - 1, day));
    if (
        asDate.getUTCFullYear() !== year ||
        asDate.getUTCMonth() !== month - 1 ||
        asDate.getUTCDate() !== day
    ) return '';
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function maskDateInput(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

let n = 0;
const eq = (actual, expected, label) => { assert.equal(actual, expected, label); n++; };

// --- isoToDisplay ---
eq(isoToDisplay('2026-09-01'), '01/09/2026', 'iso -> dd/mm/yyyy');
eq(isoToDisplay('2026-12-31'), '31/12/2026', 'end of year');
// Full timestamps appear on records read back from the API.
eq(isoToDisplay('2026-09-01T00:00:00.000Z'), '01/09/2026', 'iso timestamp is truncated');
eq(isoToDisplay(''), '', 'empty');
eq(isoToDisplay(null), '', 'null');
eq(isoToDisplay(undefined), '', 'undefined');
eq(isoToDisplay('nonsense'), '', 'unparseable');

// --- displayToIso ---
eq(displayToIso('01/09/2026'), '2026-09-01', 'dd/mm/yyyy -> iso');
eq(displayToIso('1/9/2026'), '2026-09-01', 'single digits are padded');
eq(displayToIso(' 01/09/2026 '), '2026-09-01', 'surrounding whitespace');
eq(displayToIso('29/02/2024'), '2024-02-29', 'leap day in a leap year');
// The bug this guard exists for.
eq(displayToIso('29/02/2025'), '', 'leap day in a non-leap year is rejected');
eq(displayToIso('31/02/2026'), '', '31 February is rejected, not rolled to March');
eq(displayToIso('31/04/2026'), '', '31 April is rejected');
eq(displayToIso('00/09/2026'), '', 'day zero');
eq(displayToIso('01/13/2026'), '', 'month 13');
eq(displayToIso('01/00/2026'), '', 'month zero');
eq(displayToIso('2026-09-01'), '', 'iso is not accepted as display');
eq(displayToIso('01/09/26'), '', 'two-digit year is rejected');
eq(displayToIso(''), '', 'empty');

// --- maskDateInput ---
eq(maskDateInput('0'), '0', 'first digit');
eq(maskDateInput('01'), '01', 'two digits, no slash yet');
eq(maskDateInput('019'), '01/9', 'slash appears at the third digit');
eq(maskDateInput('0109'), '01/09', 'day and month');
eq(maskDateInput('01092'), '01/09/2', 'second slash at the fifth digit');
eq(maskDateInput('01092026'), '01/09/2026', 'complete');
eq(maskDateInput('010920261234'), '01/09/2026', 'excess digits are dropped');
eq(maskDateInput('01/09/2026'), '01/09/2026', 'already formatted is stable');
eq(maskDateInput('ab01cd09ef2026'), '01/09/2026', 'letters are stripped');
eq(maskDateInput(''), '', 'empty');

// --- round trip ---
for (const iso of ['2026-01-01', '2026-02-29', '2024-02-29', '2026-12-31', '2025-06-15']) {
    const back = displayToIso(isoToDisplay(iso));
    // 2026-02-29 does not exist, so it must not survive the round trip.
    const expected = iso === '2026-02-29' ? '' : iso;
    eq(back, expected, `round trip ${iso}`);
}

// Masking a display value must always leave something displayToIso can read.
for (const iso of ['2026-01-05', '2024-11-30']) {
    eq(displayToIso(maskDateInput(isoToDisplay(iso))), iso, `mask is lossless for ${iso}`);
}

console.log(`dateFormat: ${n} checks passed`);
