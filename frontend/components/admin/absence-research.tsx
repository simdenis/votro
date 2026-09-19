'use client'

// AI research over a month's top-10 absentees (/admin) — one button, one
// Claude call with web search server-side. Findings are read-only: a found
// reason suggests a context_note (which excludes the member from public
// rankings), but writing it stays a deliberate manual step.

import { useState } from 'react'

type Entry = {
  name: string; party: string; chamber: string
  absent: number; held: number
  verdict: 'motiv_gasit' | 'posibil_motiv' | 'nimic_gasit'
  reason: string
  suggested_note: string | null
  sources: string[]
}

const VERDICT_UI: Record<Entry['verdict'], { label: string; cls: string }> = {
  motiv_gasit: { label: 'motiv găsit', cls: 'text-respins' },
  posibil_motiv: { label: 'posibil motiv', cls: 'text-tacit' },
  nimic_gasit: { label: 'nimic găsit', cls: 'text-adoptat' },
}

export function AbsenceResearch({ months }: {
  months: { value: string; label: string }[]
}) {
  const [month, setMonth] = useState(months[0]?.value ?? '')
  const [state, setState] = useState<
    | { phase: 'idle' }
    | { phase: 'busy' }
    | { phase: 'done'; entries: Entry[] }
    | { phase: 'error'; message: string }
  >({ phase: 'idle' })

  async function run() {
    setState({ phase: 'busy' })
    try {
      const r = await fetch('/api/admin/research-absente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
      setState({ phase: 'done', entries: body.entries })
    } catch (e) {
      setState({ phase: 'error', message: String(e instanceof Error ? e.message : e) })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={month} onChange={e => setMonth(e.target.value)}
                className="text-[12px] bg-surface border border-rim rounded-md px-2 py-1">
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button onClick={run} disabled={state.phase === 'busy'}
                className="text-[13px] font-medium px-3 py-1.5 rounded-md border border-rim hover:bg-raised transition-colors disabled:opacity-50">
          {state.phase === 'busy' ? 'Caută pe web… (~1-2 min)' : '🔍 Research AI pe top 10'}
        </button>
      </div>
      {state.phase === 'error' && (
        <p className="text-[12px] text-respins">Eroare: {state.message.slice(0, 300)}</p>
      )}
      {state.phase === 'done' && (
        <div className="flex flex-col divide-y divide-rim border border-rim rounded-xl mt-1">
          {state.entries.map(e => (
            <div key={e.name} className="px-3 py-2.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[13px] font-semibold">{e.name}</span>
                <span className="text-[11px] text-faint">{e.party} · {e.chamber} · {e.absent}/{e.held} absențe</span>
                <span className={`text-[11px] font-semibold uppercase ${VERDICT_UI[e.verdict].cls}`}>
                  {VERDICT_UI[e.verdict].label}
                </span>
              </div>
              <p className="text-[12.5px] text-muted mt-0.5">{e.reason}</p>
              {e.suggested_note && (
                <p className="text-[12px] mt-0.5">
                  <span className="text-faint">context_note sugerat: </span>
                  <code className="bg-surface border border-rim rounded px-1">{e.suggested_note}</code>
                  <span className="text-faint"> — dacă e legitim, setează-l în DB ca să iasă din clasament</span>
                </p>
              )}
              {e.sources.length > 0 && (
                <p className="text-[11px] mt-0.5 flex gap-2 flex-wrap">
                  {e.sources.map(s => (
                    <a key={s} href={s} target="_blank" rel="noopener noreferrer"
                       className="text-info underline underline-offset-2 truncate max-w-[260px]">
                      {(() => { try { return new URL(s).hostname } catch { return s } })()}
                    </a>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
