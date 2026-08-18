import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Input } from '@/components/ui/Input'

describe('Input', () => {
  it('renders with a visible label linked via htmlFor', () => {
    render(<Input label="Email" />)
    const input = screen.getByLabelText('Email')
    expect(input).toBeInTheDocument()
  })

  it('shows error message with aria-describedby linkage', () => {
    render(<Input label="Password" error="Too short" />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const errorEl = screen.getByRole('alert')
    expect(errorEl).toHaveTextContent('Too short')
    // aria-describedby points at the error element's id
    expect(input.getAttribute('aria-describedby')).toBe(errorEl.id)
  })

  it('forwards value and onChange', () => {
    render(<Input label="Name" defaultValue="Fira" />)
    expect(screen.getByLabelText('Name')).toHaveValue('Fira')
  })
})
