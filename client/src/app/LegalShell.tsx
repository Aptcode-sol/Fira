'use client';

import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import {
    legalBodyClass,
    legalCardClass,
    legalContainerClass,
    legalHeadingClass,
    legalMetaClass,
    legalNoteClass,
} from './legalStyles';

/**
 * ponytail: the page shell shared by the three legal documents. Uniformity was
 * the requirement, so the background, navbar, container, card, heading and
 * masthead live here once instead of being copy-pasted per document. Each page
 * supplies only its own sections as children.
 */
export default function LegalShell({
    title,
    meta,
    note,
    children,
}: {
    title: string;
    /** Masthead lines: version, effective date, jurisdiction, support. */
    meta: string[];
    /** Optional italic precedence note (used by the two sub-agreements). */
    note?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
            <PartyBackground />
            <Navbar />

            <main className={legalContainerClass}>
                <article className={legalCardClass}>
                    <h1 className={legalHeadingClass}>{title}</h1>

                    <div className={legalMetaClass}>
                        {meta.map((line) => (
                            <p key={line}>{line}</p>
                        ))}
                        {note && <p className={legalNoteClass}>{note}</p>}
                    </div>

                    <div className={legalBodyClass}>{children}</div>
                </article>
            </main>
        </div>
    );
}
