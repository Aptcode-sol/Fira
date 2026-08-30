import { readFileSync, writeFileSync } from 'node:fs';

const p = 'src/components/modals/CreateEventModal.tsx';
let s = readFileSync(p, 'utf8');
const crlf = s.includes('\r\n');
const fix = (t) => (crlf ? t.replace(/\n/g, '\r\n') : t);

const edits = [
  // 1. A blank draft starts with one named tier. Every ticket must carry a tier name,
  //    because that name is what a door scanner is scoped to.
  [
    `        ticketTiers: [{ name: '', price: 0, description: '', maxQuantity: 1 }] as TicketTier[],`,
    `        // Every event has at least one tier: the tier name is what a ticket records
        // and what a door scanner admits, so "no tier" would leave a ticket with
        // nothing to check at the gate. Defaulted to General rather than blank so an
        // organiser who does not care about tiers is never blocked by the field.
        ticketTiers: [{ name: 'General', price: 0, description: '', maxQuantity: 1 }] as TicketTier[],`,
  ],

  // 2. Tier names are validated on every event, not only paid ones. Price only matters
  //    when the event is paid.
  [
    `        if (currentStep === 3 && formData.ticketType === 'paid') {`,
    `        if (currentStep === 3) {`,
  ],

  // 3. Always send the tiers.
  [
    `            if (formData.ticketType === 'paid') {
                eventData.ticketTiers = formData.ticketTiers.map(t => ({
                    name: t.name.trim(),
                    price: t.price,
                    description: t.description.trim(),
                    maxQuantity: Number(t.maxQuantity) || 1,
                }));
            }`,
    `            // Always sent, for free events too: a free event still needs a named tier
            // so its tickets can be checked in at a tier-scoped door. A free tier is
            // simply priced at 0.
            eventData.ticketTiers = formData.ticketTiers.map(t => ({
                name: t.name.trim(),
                price: formData.ticketType === 'paid' ? t.price : 0,
                description: t.description.trim(),
                maxQuantity: Number(t.maxQuantity) || 1,
            }));`,
  ],

  // 4. The tier editor is always shown. Price is hidden on a free event.
  [
    `                                {formData.ticketType === 'paid' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-medium text-gray-300">Ticket Tiers</label>
                                            <span className="text-xs text-gray-500">{formData.ticketTiers.length}/10</span>
                                        </div>`,
    `                                {/* Shown for free events too - the tier name is required
                                    either way. Only the price is paid-only. */}
                                <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-medium text-gray-300">Ticket Tiers *</label>
                                            <span className="text-xs text-gray-500">{formData.ticketTiers.length}/10</span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Each tier gets its own door scanner link. Leave it as
                                            General if you only need one kind of entry.
                                        </p>`,
  ],

  // Price input becomes paid-only.
  [
    `                                                    <div>
                                                        <input
                                                            type="number"
                                                            placeholder="Price (₹)"
                                                            min={0}
                                                            value={tier.price || ''}`,
    `                                                    <div className={formData.ticketType === 'paid' ? '' : 'hidden'}>
                                                        <input
                                                            type="number"
                                                            placeholder="Price (₹)"
                                                            min={0}
                                                            value={tier.price || ''}`,
  ],

  // Name spans the row when there is no price beside it.
  [
    `                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <input
                                                            type="text"
                                                            placeholder="Tier name"`,
    `                                                <div className={formData.ticketType === 'paid' ? 'grid grid-cols-2 gap-3' : ''}>
                                                    <div>
                                                        <input
                                                            type="text"
                                                            placeholder="Tier name"`,
  ],

  // Close the now-unconditional wrapper.
  [
    `                                            + Add Tier
                                        </button>
                                    </div>
                                )}`,
    `                                            + Add Tier
                                        </button>
                                </div>`,
  ],
];

for (const [needle, replacement] of edits) {
  const n = fix(needle);
  if (!s.includes(n)) throw new Error('NOT FOUND:\n' + needle.slice(0, 200));
  s = s.replace(n, fix(replacement));
}

writeFileSync(p, s);
console.log('patched', p);
