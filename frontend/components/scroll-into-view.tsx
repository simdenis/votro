'use client'

import { useEffect, useRef } from 'react'

/** Scrolls itself into view on mount — remount with `key` to retrigger.
 *  Used on /parlamentarul-tau so picking a county jumps to the results. */
export function ScrollIntoView() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // next frame — let the RSC payload finish committing layout first
    const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    return () => clearTimeout(t)
  }, [])
  return <div ref={ref} className="scroll-mt-4" aria-hidden />
}
