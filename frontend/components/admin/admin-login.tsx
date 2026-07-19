'use client'

import { useState } from 'react'

// Minimal login for /admin — posts the key to /api/admin/login, which sets an
// httpOnly cookie; on success we reload so the server component re-renders
// authenticated. The key lives only in this input, never in the URL.
export function LogoutButton() {
  return (
    <button
      onClick={async () => { await fetch('/api/admin/logout', { method: 'POST' }); window.location.href = '/admin' }}
      className="text-[11px] text-faint underline underline-offset-2 flex-shrink-0 mt-1.5"
    >
      ieși
    </button>
  )
}

export function AdminLogin() {
  const [key, setKey] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (r.ok) { window.location.href = '/admin'; return }
      setErr('Cheie greșită.')
    } catch {
      setErr('Eroare de rețea.')
    }
    setBusy(false)
  }

  return (
    <div className="max-w-sm mx-auto mt-24">
      <h1 className="text-lg font-bold mb-1">Admin</h1>
      <p className="text-[13px] text-muted mb-4">Introdu cheia de acces.</p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          type="password" value={key} onChange={e => setKey(e.target.value)}
          autoFocus autoComplete="off" placeholder="cheie admin"
          className="w-full text-[13px] bg-surface border border-rim rounded-lg px-3 py-2"
        />
        <button type="submit" disabled={busy || !key}
                className="text-[13px] font-medium px-3 py-2 rounded-lg bg-foreground text-background disabled:opacity-50">
          {busy ? 'Se verifică…' : 'Intră'}
        </button>
        {err && <span className="text-[12px] text-respins">{err}</span>}
      </form>
    </div>
  )
}
