'use client'

import { useState } from 'react'

/** Newsletter signup — posts to /api/newsletter (Resend audience). */
export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'busy') return
    setState('busy')
    try {
      const r = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await r.json().catch(() => ({}))
      if (r.ok) {
        setState('done')
      } else {
        setState('error')
        setMessage(body.error ?? 'Ceva n-a mers. Încearcă din nou.')
      }
    } catch {
      setState('error')
      setMessage('Ceva n-a mers. Încearcă din nou.')
    }
  }

  if (state === 'done') {
    return (
      <p className={`${compact ? 'text-[12.5px]' : 'text-sm'} text-adoptat font-medium`}>
        Te-ai abonat. Primul număr ajunge vinerea viitoare.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="emailul tău"
          className={`flex-1 min-w-0 bg-surface border border-rim rounded-lg px-3 ${compact ? 'py-1.5 text-[12.5px]' : 'py-2 text-sm'} text-foreground placeholder:text-faint focus:outline-none focus:border-foreground/40 transition-colors`}
        />
        <button
          type="submit"
          disabled={state === 'busy'}
          className={`shrink-0 rounded-lg ${compact ? 'px-3 py-1.5 text-[12.5px]' : 'px-4 py-2 text-sm'} font-semibold text-white disabled:opacity-60 transition-opacity`}
          style={{ background: 'var(--sidebar-bg)' }}
        >
          {state === 'busy' ? '…' : 'Abonează-te'}
        </button>
      </div>
      {state === 'error' && <p className="text-[12px] text-respins">{message}</p>}
      <p className="text-[11px] text-faint">Săptămânal, vinerea. Te poți dezabona oricând, dintr-un click.</p>
    </form>
  )
}
