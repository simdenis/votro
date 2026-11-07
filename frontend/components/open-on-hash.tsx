'use client'

import { useEffect } from 'react'

/** Opens the <details> whose id matches the URL hash, so deep links into a folded section land open. */
export function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (el instanceof HTMLDetailsElement) {
        el.open = true
        el.scrollIntoView()
      }
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])
  return null
}
