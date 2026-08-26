import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import BrandHeader from '@/components/BrandHeader'

// next/image needs a plain <img> shim under the test DOM.
vi.mock('next/image', () => ({
    default: ({ fill, ...props }: Record<string, unknown>) => {
        void fill // drop the Next-only boolean so the DOM doesn't warn
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return <img {...(props as Record<string, unknown>)} />
    },
}))

const brand = {
    _id: 'b1',
    name: 'Test Brand',
    bio: 'A test bio',
    coverPhoto: '',
    profilePhoto: '',
    stats: { followers: 10, events: 2 },
    type: 'creator',
}

describe('BrandHeader — creators/brands mobile layout (14.2)', () => {
    it('aligns the header column to the start on mobile and to the end on desktop (not flush-right)', () => {
        const { container } = render(
            <BrandHeader brand={brand} onFollow={() => {}} isFollowing={false} />
        )
        // The header row must not use bare `items-end` (which flush-rights the
        // stacked mobile column). It must start-align on mobile, end-align on md+.
        const row = container.querySelector('.flex.flex-col')
        expect(row).not.toBeNull()
        const cls = row!.className
        expect(cls).toContain('items-start')
        expect(cls).toContain('md:items-end')
        expect(cls).not.toMatch(/(^|\s)items-end(\s|$)/)
    })

    it('still renders the brand name and follow action (preservation 15.2)', () => {
        render(<BrandHeader brand={brand} onFollow={() => {}} isFollowing={false} />)
        expect(screen.getByText('Test Brand')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /follow/i })).toBeInTheDocument()
    })
})
