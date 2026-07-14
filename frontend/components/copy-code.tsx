'use client'

import { useState } from 'react'

/** A code block with a copy-to-clipboard button — for the open-data page's
 *  curl examples. Button nods to the site's tactile-button style. */
export function CopyCode({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className="relative group">
      <pre className="bg-raised border border-rim rounded-lg p-3.5 pr-20 text-[12px] leading-relaxed overflow-x-auto whitespace-pre">
        <code>{children}</code>
      </pre>
      <button
        onClick={copy}
        aria-label={copied ? 'Copiat' : 'Copiază'}
        className={`absolute top-2 right-2 px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
          copied ? 'text-adoptat' : 'text-faint hover:text-foreground'
        }`}
      >
        {copied ? 'Copiat ✓' : 'Copiază'}
      </button>
    </div>
  )
}
