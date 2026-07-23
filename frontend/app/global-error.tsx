'use client'

import { useEffect } from 'react'

// Last-resort boundary: catches errors thrown by the root layout itself, where
// the normal error.tsx can't render. Must ship its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      navigator.sendBeacon?.(
        '/api/clientlog',
        JSON.stringify({ msg: error.message, stack: error.stack, digest: error.digest, url: location?.href }),
      )
    } catch {
      /* noop */
    }
  }, [error])

  return (
    <html lang="ro">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '80px 20px', color: '#111' }}>
        <h1 style={{ fontSize: 24, fontWeight: 400 }}>Ceva n-a mers</h1>
        <p style={{ fontSize: 14, color: '#666', maxWidth: 420, margin: '12px auto' }}>
          A apărut o eroare neașteptată. Încearcă din nou.
        </p>
        <button onClick={reset} style={{ fontSize: 14, textDecoration: 'underline', background: 'none', border: 0, cursor: 'pointer' }}>
          Reîncearcă
        </button>
      </body>
    </html>
  )
}
