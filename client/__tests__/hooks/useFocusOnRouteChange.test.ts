import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock Next.js navigation — must be before the hook import
vi.mock('next/navigation', () => ({
  usePathname: () => '/test',
}))

import { useFocusOnRouteChange } from '@/hooks/useFocusOnRouteChange'

describe('useFocusOnRouteChange', () => {
  it('can be called without error (smoke test)', () => {
    const { result } = renderHook(() => useFocusOnRouteChange())
    // Hook returns void — just verifying no throw
    expect(result.current).toBeUndefined()
  })
})
