// ponytail: ONE shared style contract for the five legal/static pages
// (privacy, terms, refund-policy, help, community-guidelines). Reused as class
// strings — no component abstraction. Ceiling: if a legal page ever needs a
// genuinely different layout, give it its own classes instead of forking these.

// Site-standard content container (matches HomeClient/BrandHeader/marketing sections).
export const legalContainerClass =
    'relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto';

// Single heading style shared across all five <h1>s, replacing the divergent
// per-page gradients.
export const legalHeadingClass =
    'text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent';
