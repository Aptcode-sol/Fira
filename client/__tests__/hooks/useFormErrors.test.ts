import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFormErrors } from '@/hooks/useFormErrors'

describe('useFormErrors', () => {
  it('focusFirstError focuses the first aria-invalid element', () => {
    const { result } = renderHook(() => useFormErrors())

    // Create a mock form with an invalid input
    const form = document.createElement('form')
    const input = document.createElement('input')
    input.setAttribute('aria-invalid', 'true')
    form.appendChild(input)
    document.body.appendChild(form)

    // Assign the form to the ref
    Object.defineProperty(result.current.formRef, 'current', {
      value: form,
      writable: true,
    })

    result.current.focusFirstError()
    expect(document.activeElement).toBe(input)

    // Cleanup
    document.body.removeChild(form)
  })

  it('does nothing when no invalid elements exist', () => {
    const { result } = renderHook(() => useFormErrors())

    const form = document.createElement('form')
    const input = document.createElement('input')
    form.appendChild(input)
    document.body.appendChild(form)

    Object.defineProperty(result.current.formRef, 'current', {
      value: form,
      writable: true,
    })

    result.current.focusFirstError()
    // Focus should NOT have moved to the input (it has no aria-invalid)
    expect(document.activeElement).not.toBe(input)

    document.body.removeChild(form)
  })
})
