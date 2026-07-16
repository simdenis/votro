'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatDate, choiceLabel, choiceColor, capFirst } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import type { VoteHistoryRow } from '@/lib/types'

const PAGE = 20

/**
 * MP vote history with category filter + show-more. The profile used to dump
 * all ~100 fetched rows at once, making the page enormous and unreadable.
 */
export function VoteHistory({ rows }: { rows: VoteHistoryRow[] }) {
  const [category, setCategory] = useState('')
  const [onlyDeviations, setOnlyDeviations] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.votes.laws?.law_category) set.add(r.votes.laws.law_category)
    return [...set].sort()
  }, [rows])

  const filtered = useMemo(
    () =>
      rows.filter(r => {
        if (category && r.votes.laws?.law_category !== category) return false
        if (onlyDeviations && !r.party_line_deviation) return false
        return true
      }),
    [rows, category, onlyDeviations],
  )

  const shown = filtered.slice(0, limit)
  const baseSelect =
    'border border-rim rounded-md text-xs px-2.5 py-1.5 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-[#5050c0]'

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Activitate recentă</h2>
        {rows.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {categories.length > 0 && (
              <select className={baseSelect} value={category} onChange={e => { setCategory(e.target.value); setLimit(PAGE) }}>
                <option value="">Toate categoriile</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <button
              onClick={() => { setOnlyDeviations(v => !v); setLimit(PAGE) }}
              className={`text-xs rounded-md px-2.5 py-1.5 border transition-colors ${onlyDeviations ? 'border-deviere text-deviere bg-deviere/10' : 'border-rim text-muted hover:text-foreground'}`}
            >
              Doar devieri
            </button>
          </div>
        )}
      </div>

      {!rows.length ? (
        <p className="text-sm text-muted">Nu există voturi înregistrate.</p>
      ) : !filtered.length ? (
        <p className="text-sm text-muted">Niciun vot pentru filtrul ales.</p>
      ) : (
        <>
          <div className="bg-surface border border-rim rounded-xl overflow-hidden divide-y divide-rim">
            {shown.map(row => (
              <Link
                key={row.id}
                href={`/voturi/${row.vote_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-raised transition-colors"
                style={row.party_line_deviation ? { backgroundColor: 'oklch(98% 0.02 80)' } : undefined}
              >
                <div className="w-0.5 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: choiceColor(row.vote_choice) }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-xs text-muted">{row.votes.laws?.code ?? '—'}</span>
                    <span className="text-[10px] text-faint">{formatDate(row.votes.vote_date)}</span>
                    {row.votes.vote_type && (
                      <span className="text-[10px] uppercase text-faint bg-raised border border-rim rounded px-1.5 py-px">
                        {row.votes.vote_type}
                      </span>
                    )}
                    {row.party_line_deviation && (
                      <span className="text-[10px] bg-deviere/10 text-deviere font-bold rounded px-1.5 py-px">⚠ deviere</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground truncate">
                    {capFirst(row.votes.laws?.title ?? row.votes.description ?? '') || 'Vot procedural (fără lege identificată)'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold" style={{ color: choiceColor(row.vote_choice) }}>
                    {choiceLabel(row.vote_choice)}
                  </span>
                  <OutcomeBadge outcome={row.votes.outcome} />
                </div>
              </Link>
            ))}
          </div>

          {limit < filtered.length && (
            <button
              onClick={() => setLimit(filtered.length)}
              className="mt-3 text-sm text-muted underline underline-offset-2 hover:text-foreground"
            >
              Toate voturile ({filtered.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
