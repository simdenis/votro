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

// which presets have a ready-made shareable card image
const cardKindOf = (p: Preset): 'law' | 'mp' | null =>
  p === 'law_detail' || p === 'law_votes' ? 'law' : p === 'mp' ? 'mp' : null

// encode spaces (names) but leave /, ., *, - readable
const q = (v: string) => v.trim().replace(/ /g, '%20')

export function ApiBuilder({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) {
  const [preset, setPreset] = useState<Preset>('law_votes')
  const [code, setCode] = useState('L230/2025')
  const [from, setFrom] = useState('2026-02-01')
  const [to, setTo] = useState('2026-06-30')
  const [chamber, setChamber] = useState('')          // '' = ambele (period) / 'deputies' default (mp)
  const [mpChamber, setMpChamber] = useState<'deputies' | 'senate'>('deputies')
  const [name, setName] = useState('Ponta')
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [busy, setBusy] = useState(false)

  const path = useMemo(() => {
    switch (preset) {
      case 'law_votes':
        return `votes?select=vote_date,chamber,outcome,for_count,against_count,abstention_count,laws!inner(code,title)&laws.code=eq.${q(code)}&order=vote_date.desc`
      case 'law_detail':
        return `law_status?code=eq.${q(code)}`
      case 'period_votes': {
        const p = [`vote_date=gte.${q(from)}`, `vote_date=lte.${q(to)}`]
        if (chamber) p.push(`chamber=eq.${chamber}`)
        p.push('order=vote_date.desc')
        return `votes?${p.join('&')}`
      }
      case 'mp':
        return `${mpChamber === 'senate' ? 'senator_stats' : 'deputy_stats'}?name=ilike.*${q(name)}*`
    }
  }, [preset, code, from, to, chamber, mpChamber, name])

  const cardKind = cardKindOf(preset)
  // resolve the row id, then download our own OG card PNG for it
  async function downloadCard() {
    setBusy(true)
    try {
      let og = ''
      if (cardKind === 'law') {
        const r = await fetch(`${baseUrl}/rest/v1/laws?code=eq.${q(code)}&select=id&limit=1`, { headers: { apikey: apiKey } })
        const id = (await r.json())[0]?.id
        if (!id) return
        og = `/api/og/summarycard?id=${id}`
      } else if (cardKind === 'mp') {
        const view = mpChamber === 'senate' ? 'senator_stats' : 'deputy_stats'
        const r = await fetch(`${baseUrl}/rest/v1/${view}?name=ilike.*${q(name)}*&select=politician_id&limit=1`, { headers: { apikey: apiKey } })
        const id = (await r.json())[0]?.politician_id
        if (!id) return
        og = `/api/og/senatorcard?id=${id}`
      }
      const res = await fetch(og)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `labutoane-card.png`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(a.href)
    } catch { /* blocked */ } finally { setBusy(false) }
  }

  const url = `${baseUrl}/rest/v1/${path}`
  const curl = `curl "${url}" \\\n  -H "apikey: ${apiKey}"${format === 'csv' ? ' \\\n  -H "Accept: text/csv"' : ''}`

  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(curl); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
  }
  // fmt passed explicitly — the variant buttons setFormat() (for the shown curl)
  // and download in one click, and setState wouldn't be visible synchronously
  async function download(fmt: 'json' | 'csv' = format) {
    setBusy(true)
    try {
      const res = await fetch(url, { headers: { apikey: apiKey, ...(fmt === 'csv' ? { Accept: 'text/csv' } : {}) } })
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

      {/* command */}
      {/* command — copy button sits in the header row, not over the code, so it
          stays legible in the narrow sidebar column */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] uppercase tracking-widest text-muted font-semibold">Comandă</span>
          <button onClick={copy} className={`px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${copied ? 'text-adoptat' : 'text-faint hover:text-foreground'}`}>
            {copied ? 'Copiat ✓' : 'Copiază'}
          </button>
        </div>
        <pre className="bg-raised border border-rim rounded-lg p-3 text-[11.5px] leading-relaxed overflow-x-auto whitespace-pre"><code>{curl}</code></pre>
      </div>

      {/* output variants — JSON / CSV download the query, imagine grabs the card */}
      <div>
        <span className="text-[11px] uppercase tracking-widest text-muted font-semibold">Descarcă</span>
        <div className="flex flex-wrap gap-2 mt-1.5">
          <button onClick={() => { setFormat('json'); download('json') }} disabled={busy}
            className="btn-tactile rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--sidebar-bg)' }}>
            JSON
          </button>
          <button onClick={() => { setFormat('csv'); download('csv') }} disabled={busy}
            className="btn-tactile rounded-lg px-3.5 py-1.5 text-[12px] font-semibold bg-surface border border-rim text-foreground disabled:opacity-60">
            CSV
          </button>
          {cardKind && (
            <button onClick={downloadCard} disabled={busy}
              className="btn-tactile rounded-lg px-3.5 py-1.5 text-[12px] font-semibold bg-surface border border-rim text-foreground disabled:opacity-60">
              🖼 Imagine
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
