import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/siteConfig';

/**
 * Generated share card. Every page declared `summary_large_image` but no image
 * existed, so links pasted into WhatsApp, X or Slack rendered as a bare URL -
 * which kills click-through on exactly the channel a new brand grows on.
 */
export const alt = `${SITE_NAME} - ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#08070c',
                    backgroundImage:
                        'radial-gradient(circle at 22% 18%, rgba(139,92,246,0.42) 0%, transparent 46%), radial-gradient(circle at 80% 82%, rgba(236,72,153,0.34) 0%, transparent 48%)',
                    fontFamily: 'sans-serif',
                }}
            >
                <div
                    style={{
                        fontSize: 190,
                        fontWeight: 900,
                        letterSpacing: '-0.04em',
                        color: '#ffffff',
                        lineHeight: 1,
                    }}
                >
                    {SITE_NAME}
                </div>
                <div
                    style={{
                        marginTop: 26,
                        fontSize: 42,
                        color: '#c4b5fd',
                        fontWeight: 600,
                        textAlign: 'center',
                    }}
                >
                    {SITE_TAGLINE}
                </div>
                <div
                    style={{
                        marginTop: 52,
                        fontSize: 26,
                        color: '#8b8b96',
                        letterSpacing: '0.08em',
                    }}
                >
                    {SITE_URL.replace(/^https?:\/\//, '')}
                </div>
            </div>
        ),
        size
    );
}
