import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'

/**
 * Keeps keyboard focus inside an open overlay and restores it when the
 * overlay closes. The hook is intentionally small so drawers and dialogs
 * across the three KPS Cardio roles behave the same on desktop and mobile.
 */
export function useModalAccessibility(onClose: () => void, options: {
  initialFocus?: 'first' | 'container'
  closeOnEscape?: boolean
} = {}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusInitial = () => {
      const dialog = dialogRef.current
      if (!dialog) return
      if (options.initialFocus !== 'container') {
        const first = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
          .find((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
        if (first) {
          first.focus()
          return
        }
      }
      dialog.focus()
    }

    const frame = window.requestAnimationFrame(focusInitial)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && options.closeOnEscape !== false) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
    // Each overlay component mounts only while visible. The callback itself is
    // kept in a ref so rerenders do not steal focus or restart the trap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return dialogRef
}
