import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/siteConfig';

/**
 * Generated favicon: the real FIRA mark on an opaque tile.
 *
 * History, because both previous versions were wrong in opposite directions:
 *
 *  1. `icon.png` was a byte-for-byte copy of `logo white.png` - a white mark on
 *     transparency. Google composites favicons onto WHITE in search results, so it
 *     rendered as an empty disc beside every listing.
 *  2. The first replacement drew a generic letter "F". That was visible, but it is
 *     not the brand's logo, which makes it the wrong fix - a favicon whose whole job
 *     is to be recognised as this company.
 *
 * This uses the actual logo artwork, composited onto an opaque dark tile. The tile
 * is what makes the white mark legible on Google's white background, on a light
 * browser theme, and in a bookmark bar. The artwork is what makes it ours.
 *
 * Also square (192x192): Google requires a square favicon in a multiple of 48px and
 * letterboxes anything else, and the source logo is 1536x1024.
 */
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

/**
 * The logo inlined as a data URI.
 *
 * Satori (what ImageResponse renders with) cannot fetch a relative path, and giving
 * it an absolute URL would make icon generation depend on the site being reachable
 * from itself. Reading off disk keeps it a pure build-time operation.
 */
function logoDataUri(): string {
    const file = readFileSync(join(process.cwd(), 'public', 'logo white.png'));
    return `data:image/png;base64,${file.toString('base64')}`;
}

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
                    // Opaque, not transparent. Transparency is precisely what let the
                    // original icon vanish into Google's white result background.
                    background: '#0a0a0a',
                    backgroundImage:
                        'radial-gradient(circle at 28% 20%, rgba(139,92,246,0.5) 0%, transparent 60%), radial-gradient(circle at 78% 84%, rgba(236,72,153,0.38) 0%, transparent 58%)',
                }}
            >
                {/* Padded and contained rather than filling the tile: the artwork is
                    3:2, so stretching it to a square would distort the mark. */}
                <img
                    src={logoDataUri()}
                    alt={SITE_NAME}
                    width={152}
                    height={101}
                    style={{ objectFit: 'contain' }}
                />
            </div>
        ),
        size
    );
}
