import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SkipLink from '@/components/SkipLink'

describe('SkipLink', () => {
  it('renders a link targeting #main-content', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: /skip to content/i })
    expect(link).toHaveAttribute('href', '#main-content')
  })

  it('has sr-only class for off-screen positioning (hidden by default)', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: /skip to content/i })
    expect(link.className).toContain('sr-only')
  })

  it('has focus:not-sr-only class so it becomes visible on focus', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: /skip to content/i })
    expect(link.className).toContain('focus:not-sr-only')
  })
})
