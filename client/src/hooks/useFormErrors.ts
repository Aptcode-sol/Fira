'use client';

import { useRef, useCallback } from 'react';

/**
 * Provides focus-first-invalid-field behavior on form submit with errors.
 * 
 * Usage:
 *   const { formRef, focusFirstError } = useFormErrors();
 *   // In your submit handler, after validation fails:
 *   focusFirstError();
 *   // Wrap your form:
 *   <form ref={formRef}>...</form>
 */
export function useFormErrors() {
  const formRef = useRef<HTMLFormElement>(null);

  const focusFirstError = useCallback(() => {
    if (!formRef.current) return;

    // Find the first element with aria-invalid="true"
    const firstInvalid = formRef.current.querySelector<HTMLElement>(
      '[aria-invalid="true"]'
    );
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    // Fallback: find first input with a sibling error (role="alert")
    const firstAlert = formRef.current.querySelector<HTMLElement>('[role="alert"]');
    if (firstAlert) {
      // The alert is likely a sibling of the input container — find the input
      const container = firstAlert.closest('.w-full');
      const input = container?.querySelector<HTMLElement>('input, select, textarea');
      input?.focus();
    }
  }, []);

  return { formRef, focusFirstError };
}
