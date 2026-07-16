'use client'

import { useEffect, useState } from 'react'

/**
 * Minimal open-data widget for the homepage: type a law code, get its card
 * image + JSON. No curl, no CSV — the full builder lives on /date.
 */
export function LawQuick() {
  const [code, setCode] = useState('L230/2025')
  const [lawId, setLawId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const clean = code.trim()
  const jsonHref = `/api/v1/laws?code=${encodeURIComponent(clean)}`

  useEffect(() => {
    if (!clean) { setLawId(null); setNotFound(false); return }
    let cancelled = false
    fetch(jsonHref)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        const id = Array.isArray(d) ? d[0]?.law_id ?? null : null
        setLawId(id)
        setNotFound(!id)
      })
      .catch(() => { if (!cancelled) { setLawId(null); setNotFound(true) } })
    return () => { cancelled = true }
  }, [clean, jsonHref])

  return (
    <div className="space-y-2.5">
      <label className="block">
        <span className="text-[11px] text-faint">Cod lege</span>
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="L230/2025"
          spellCheck={false}
          className="mt-1 w-full border border-rim rounded-md text-sm px-3 py-1.5 bg-surface text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-[#5050c0]"
        />
      </label>
      <div className="flex flex-col gap-1.5 text-[13px]">
        <a
          href={lawId ? `/api/og/summarycard?id=${lawId}` : undefined}
          download={lawId ? `labutoane-${clean.replace(/[^\w]+/g, '-')}.png` : undefined}
          aria-disabled={!lawId}
          className={`inline-flex items-center gap-2 ${lawId ? 'text-muted hover:text-foreground' : 'text-faint pointer-events-none opacity-50'}`}
        >
          🖼 Descarcă imaginea
        </a>
        <a href={jsonHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-muted hover:text-foreground font-mono">
          {'{ }'} JSON
        </a>
        {notFound && <span className="text-[11px] text-faint">Codul nu a fost găsit.</span>}
      </div>
    </div>
  )
}
