'use client'

import { useState } from 'react'

// "🔔 Urmărește" — follow a law or MP by email (double opt-in). Expands to an
// email field, posts to /api/alerts/subscribe, then tells you to confirm.
export function FollowButton({ targetType, targetId, what }: {
  targetType: 'law' | 'politician'
  targetId: string
  /** short noun for the copy, e.g. "această lege" / "acest parlamentar" */
  what: string
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('busy')
    try {
      const r = await fetch('/api/alerts/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, targetType, targetId }),
      })
      setState(r.ok ? 'done' : 'error')
    } catch { setState('error') }
  }

  if (state === 'done') {
    return (
      <p className="text-[12.5px] text-adoptat">
        ✓ Ți-am trimis un email de confirmare. Dă click pe link ca să primești alerte.
      </p>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-md border border-rim text-muted hover:text-foreground hover:bg-raised transition-colors">
        🔔 Urmărește
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 flex-wrap">
      <input
        type="email" required value={email} onChange={e => setEmail(e.target.value)}
        autoFocus placeholder="emailul tău"
        className="text-[13px] bg-surface border border-rim rounded-md px-3 py-1.5 w-52"
      />
      <button type="submit" disabled={state === 'busy'}
              className="text-[12.5px] font-medium px-3 py-1.5 rounded-md bg-foreground text-page disabled:opacity-50">
        {state === 'busy' ? '…' : 'Abonează-mă'}
      </button>
      <span className="text-[11px] text-faint">alerte la un vot nou / promulgare pentru {what}</span>
      {state === 'error' && <span className="text-[11px] text-respins">Ceva n-a mers. Încearcă din nou.</span>}
    </form>
  )
}
