// ponytail: ONE shared style contract for the legal/static pages. The three
// legal documents (terms, organiser-agreement, host-agreement) render through
// LegalShell and use these class strings for every section, so "uniform across
// all three" is enforced by a single edit point rather than by convention.
// `/help` and `/about` still use the container + heading classes only.
// Ceiling: if a legal page ever needs a genuinely different layout, give it its
// own classes instead of forking these.

// Site-standard content container (matches HomeClient/BrandHeader/marketing sections).
export const legalContainerClass =
    'relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto';

// Single heading style shared across all <h1>s, replacing the divergent
// per-page gradients.
export const legalHeadingClass =
    'text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent';

// The glass card every legal document sits inside.
export const legalCardClass =
    'bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8 md:p-12';

// Masthead block under the <h1>: platform, version, effective date, jurisdiction.
export const legalMetaClass =
    'mb-8 -mt-4 space-y-1 text-sm text-gray-400';

// Italic "this agreement is supplementary to..." note on the two sub-agreements.
export const legalNoteClass =
    'mt-4 text-sm italic text-gray-400 border-l-2 border-violet-500/40 pl-4';

// Wrapper for the numbered sections.
export const legalBodyClass = 'space-y-8 text-gray-300 leading-relaxed';

// "1. Introduction & Acceptance"
export const legalSectionHeadingClass = 'text-xl font-semibold text-white mb-4';

// "3.1 Who can use FIRA"
export const legalSubHeadingClass =
    'text-base font-semibold text-violet-300 mt-6 mb-2';

export const legalParagraphClass = 'mb-4 last:mb-0';

export const legalListClass = 'list-disc pl-5 space-y-2 mb-4 last:mb-0';

export const legalLinkClass = 'text-violet-400 hover:text-violet-300 underline';

// Definitions / contact tables.
export const legalTableWrapClass = 'overflow-x-auto rounded-xl border border-white/10';
export const legalTableClass = 'w-full text-sm text-left border-collapse';
export const legalThClass =
    'px-4 py-3 font-semibold text-white bg-white/[0.06] border-b border-white/10 align-top';
export const legalTdClass = 'px-4 py-3 border-b border-white/[0.06] align-top';

export const legalFooterNoteClass = 'pt-8 border-t border-white/10 text-sm text-gray-400';

/**
 * TODO(legal): confirm both of these with counsel before launch. The source
 * documents ship with "[Insert Date]" and "[Insert City]" placeholders; these
 * constants are the single place to set them, and they feed the effective date
 * and the arbitration seat / exclusive jurisdiction on all three documents.
 */
export const LEGAL_EFFECTIVE_DATE = '1 September 2026';
export const LEGAL_JURISDICTION_CITY = 'Narasaraopet';
export const LEGAL_VERSION = '1.0';
export const LEGAL_SUPPORT_EMAIL = 'support@letsfira.com';
