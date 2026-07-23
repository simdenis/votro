'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Route-segment error boundary. Without this, an unhandled render error shows
// Next's blank default page. Shows a calm Romanian fallback and reports the
// error to /api/clientlog so we can *see* it happened after launch.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      navigator.sendBeacon?.(
        '/api/clientlog',
        JSON.stringify({
          msg: error.message,
          stack: error.stack,
          digest: error.digest,
          url: typeof location !== 'undefined' ? location.href : '',
        }),
      )
    } catch {
      /* logging must never make things worse */
    }
  }, [error])

  return (
    <div className="py-16 text-center space-y-4">
      <p className="font-serif text-[48px] leading-none text-foreground">Ceva n-a mers</p>
      <h1 className="font-serif text-[22px] font-normal text-foreground">A apărut o eroare la afișarea paginii</h1>
      <p className="text-sm text-muted max-w-md mx-auto">
        Nu e vina ta. Încearcă din nou, de obicei se rezolvă. Dacă persistă, spune-ne printr-un raport de eroare.
      </p>
      <div className="flex items-center justify-center gap-4 text-sm pt-2">
        <button onClick={reset} className="underline underline-offset-2 hover:text-foreground">Reîncearcă</button>
        <Link href="/" className="underline underline-offset-2 hover:text-foreground">Prima pagină</Link>
      </div>
    </div>
  )
}
