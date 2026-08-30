import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/siteConfig';

/**
 * Generated favicon.
 *
 * Replaces an `icon.png` that was a byte-for-byte copy of `logo white.png` - a
 * white mark on transparency. Google composites favicons onto a WHITE background in
 * search results, so the icon rendered as an empty circle next to every result.
 * That is the blank disc in the letsfira.com listing.
 *
 * Two things are fixed here:
 *
 *  - Contrast. The mark now sits on an opaque dark tile, so it reads on Google's
 *    white background, on a browser tab of any theme, and on a bookmark bar.
 *  - Shape. The source logo is 1536x1024. Google requires a square favicon that is
 *    a multiple of 48px, and letterboxes or crops anything else. This is 192x192.
 *
 * Generated rather than committed as a binary so it stays in step with the brand
 * colours in one place, using the same next/og path as opengraph-image.tsx.
 */
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // Opaque, not transparent: transparency is what let the old icon
                    // disappear into Google's white result background.
                    background: '#0a0a0a',
                    backgroundImage:
                        'radial-gradient(circle at 30% 22%, rgba(139,92,246,0.55) 0%, transparent 62%), radial-gradient(circle at 76% 82%, rgba(236,72,153,0.42) 0%, transparent 60%)',
                    fontFamily: 'sans-serif',
                }}
            >
                {/* A single glyph, not the wordmark. At the 16px Google and browsers
                    actually display this, four letters are an illegible smudge. */}
                <div
                    style={{
                        fontSize: 132,
                        fontWeight: 900,
                        color: '#ffffff',
                        letterSpacing: '-0.05em',
                        lineHeight: 1,
                    }}
                >
                    {SITE_NAME.charAt(0)}
                </div>
            </div>
        ),
        size
    );
}
