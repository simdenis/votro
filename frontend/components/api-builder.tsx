'use client'

import { useMemo, useState } from 'react'

// Interactive query builder for the open-data API: pick what you want, fill in
// the blanks, get a runnable curl command + a one-click file download.
type Preset = 'law_votes' | 'law_detail' | 'period_votes' | 'mp'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'law_votes',    label: 'Cum s-a votat o lege' },
  { id: 'law_detail',   label: 'Drumul unei legi prin Parlament' },
  { id: 'period_votes', label: 'Voturile dintr-o perioadă' },
  { id: 'mp',           label: 'Fișa unui parlamentar' },
]

// encode spaces (names) but leave /, ., *, - readable
const q = (v: string) => v.trim().replace(/ /g, '%20')

// `minimal` (homepage) drops the curl command block and the CSV button —
// keeps the 4 presets, JSON, and the card image. Full builder lives on /date.
export function ApiBuilder({ siteUrl = '', minimal = false }: { siteUrl?: string; minimal?: boolean }) {
  const [preset, setPreset] = useState<Preset>('law_votes')
  const [code, setCode] = useState('L230/2025')
  const [from, setFrom] = useState('2026-02-01')
  const [to, setTo] = useState('2026-06-30')
  const [chamber, setChamber] = useState('')          // '' = ambele (period)
  const [mpChamber, setMpChamber] = useState<'deputies' | 'senate'>('deputies')
  const [name, setName] = useState('Ponta')
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [busy, setBusy] = useState(false)

  // Public /api/v1 endpoint (server-side proxy, no key, CDN-cached) — replaces
  // the old direct Supabase REST line that leaked the anon key.
  const camera = (c: 'deputies' | 'senate') => (c === 'senate' ? 'senat' : 'camera')
  const endpoint = useMemo(() => {
    switch (preset) {
      case 'law_votes':
        // nominal=1 → one row per parliamentarian per vote (cum a votat fiecare)
        return `/api/v1/votes?code=${q(code)}&nominal=1`
      case 'law_detail':
        return `/api/v1/laws?code=${q(code)}`
      case 'period_votes': {
        const p = [`from=${q(from)}`, `to=${q(to)}`]
        if (chamber) p.push(`camera=${camera(chamber as 'deputies' | 'senate')}`)
        return `/api/v1/votes?${p.join('&')}`
      }
      case 'mp':
        return `/api/v1/parlamentari?camera=${camera(mpChamber)}&nume=${q(name)}`
    }
  }, [preset, code, from, to, chamber, mpChamber, name])

  const withFmt = (fmt: 'json' | 'csv') => `${endpoint}${endpoint.includes('?') ? '&' : '?'}format=${fmt}`

  const curl = `curl "${siteUrl}${endpoint}"`

  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(curl); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
  }
  // fmt passed explicitly — the variant buttons setFormat() (for the shown curl)
  // and download in one click, and setState wouldn't be visible synchronously
  async function download(fmt: 'json' | 'csv' = format) {
    setBusy(true)
    try {
      const res = await fetch(withFmt(fmt))
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `labutoane-${preset}.${fmt}`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(a.href)
    } catch { /* network/clipboard blocked */ } finally { setBusy(false) }
  }

  const inputCls = 'bg-surface border border-rim rounded-md px-2.5 py-1.5 text-[13px] text-foreground focus:outline-none focus:border-foreground/40'

  return (
    <div className="bg-surface border border-rim rounded-xl p-4 space-y-3.5">
      {/* what */}
      <label className="block">
        <span className="text-[11px] uppercase tracking-widest text-muted font-semibold">Ce vrei?</span>
        <select value={preset} onChange={e => setPreset(e.target.value as Preset)} className={`${inputCls} w-full mt-1.5`}>
          {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>

      {/* preset-specific fields */}
      <div className="flex flex-wrap gap-2 items-end">
        {(preset === 'law_votes' || preset === 'law_detail') && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-faint">Cod lege</span>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="L230/2025" className={inputCls} />
          </label>
        )}
        {preset === 'period_votes' && (
          <>
            <label className="flex flex-col gap-1"><span className="text-[11px] text-faint">De la</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] text-faint">Până la</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] text-faint">Cameră</span>
              <select value={chamber} onChange={e => setChamber(e.target.value)} className={inputCls}>
                <option value="">ambele</option><option value="senate">Senat</option><option value="deputies">Cameră</option>
              </select></label>
          </>
        )}
        {preset === 'mp' && (
          <>
            <label className="flex flex-col gap-1"><span className="text-[11px] text-faint">Cameră</span>
              <select value={mpChamber} onChange={e => setMpChamber(e.target.value as 'deputies' | 'senate')} className={inputCls}>
                <option value="deputies">Cameră</option><option value="senate">Senat</option>
              </select></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] text-faint">Nume</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ponta" className={inputCls} /></label>
          </>
        )}
      </div>

      {/* command — copy button sits in the header row, not over the code, so it
          stays legible in the narrow sidebar column. Hidden in minimal mode. */}
      {!minimal && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-widest text-muted font-semibold">Comandă</span>
            <button onClick={copy} className={`px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${copied ? 'text-adoptat' : 'text-faint hover:text-foreground'}`}>
              {copied ? 'Copiat ✓' : 'Copiază'}
            </button>
          </div>
          <pre className="bg-raised border border-rim rounded-lg p-3 text-[11.5px] leading-relaxed overflow-x-auto whitespace-pre"><code>{curl}</code></pre>
        </div>
      )}

      {/* output variants — the nominal law query is a table (a row per
          parlamentar), so CSV leads there; JSON leads elsewhere */}
      <div>
        <span className="text-[11px] uppercase tracking-widest text-muted font-semibold">Descarcă</span>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {(preset === 'law_votes' ? ['csv', 'json'] as const : ['json', 'csv'] as const).map((fmt, i) => (
            <button key={fmt} onClick={() => { setFormat(fmt); download(fmt) }} disabled={busy}
              className={`btn-tactile rounded-lg px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-60 ${
                i === 0 ? 'text-white' : 'bg-surface border border-rim text-foreground'
              }`}
              style={i === 0 ? { background: 'var(--sidebar-bg)' } : undefined}>
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
