'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDateShort, choiceLabel, choiceColor, capFirst } from '@/lib/utils'
import type { VoteHistoryRow } from '@/lib/types'

const INITIAL = 8

/** Deviations from the party line, with show-more. The card used to render a
 *  fixed slice with no hint that more existed ("4 of 15"). */
export function DeviationList({ rows, total }: { rows: VoteHistoryRow[]; total: number }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? rows : rows.slice(0, INITIAL)

  return (
    <>
      <div className="space-y-2.5">
        {shown.map(row => (
          <div key={row.id} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-deviere flex-shrink-0" />
            <Link
              href={`/voturi/${row.vote_id}`}
              className="font-mono text-xs text-muted hover:text-foreground transition-colors w-20 flex-shrink-0"
            >
              {row.votes.laws?.code ?? '—'}
            </Link>
            <span className="text-[10px] text-faint tabular-nums flex-shrink-0">{formatDateShort(row.votes.vote_date)}</span>
            {row.votes.vote_type && (
              <span
                className="text-[9px] uppercase text-faint bg-raised border border-rim rounded px-1 py-px flex-shrink-0"
                title="Tipul votului — voturile procedurale (ordine de zi, amendamente) sunt un semnal slab de disciplină de partid."
              >
                {row.votes.vote_type}
              </span>
            )}
            <span className="text-xs text-muted truncate flex-1">
              {capFirst(row.votes.laws?.title ?? row.votes.description ?? '') || 'Vot procedural (fără lege identificată)'}
            </span>
            <span className="text-xs font-bold flex-shrink-0" style={{ color: choiceColor(row.vote_choice) }}>
              {choiceLabel(row.vote_choice)}
            </span>
          </div>
        ))}
      </div>
      {rows.length > INITIAL && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 text-xs text-muted underline underline-offset-2 hover:text-foreground"
        >
          {expanded ? 'Arată mai puțin' : `Toate cele ${rows.length} devieri`}
        </button>
      )}
      {total > rows.length && (
        <p className="mt-2 text-[11px] text-faint">Se afișează cele mai recente {rows.length} din {total}.</p>
      )}
    </>
  )
}
