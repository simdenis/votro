'use client'

import { useState } from 'react'
import Link from 'next/link'
import { textOnColor } from '@/lib/utils'
import { InfoHint } from '@/components/info-hint'

type Item = {
  politician_id: string
  name: string
  first_name: string
  party_abbr: string
  party_color: string
  presence_pct: number
  /** Plenary votes held in the member's chamber — the absence denominator. */
  chamber_votes: number | null
  context_note: string | null
  href: string
}

const PAGE = 5

/** Absence ranking, paged 5 at a time — the homepage used to cap at a flat 5. */
export function AbsenceTop({ items }: { items: Item[] }) {
  const [page, setPage] = useState(0)
  const pages = Math.ceil(items.length / PAGE)
  const slice = items.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <>
      <div className="space-y-2">
        {slice.map((s, i) => (
          <Link
            key={s.politician_id}
            href={s.href}
            className="flex items-center justify-between gap-2 bg-surface border border-rim rounded-lg px-3 py-2 hover:bg-raised transition-colors"
          >
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-foreground min-w-0">
              <span className="text-[10px] text-faint tabular-nums w-4 flex-shrink-0">{page * PAGE + i + 1}.</span>
              <span
                className="text-[9px] uppercase font-bold px-1 py-px rounded flex-shrink-0"
                style={{ backgroundColor: s.party_color || '#9e9e9e', color: textOnColor(s.party_color || '#9e9e9e') }}
              >
                {s.party_abbr}
              </span>
              <span className="truncate">{s.first_name} {s.name}</span>
              {s.context_note && (
                // stop the row Link so tapping ⓘ opens the note (mobile has no hover)
                <span
                  className="flex-shrink-0"
                  onClick={e => { e.preventDefault(); e.stopPropagation() }}
                  aria-label="Există o notă de context pentru absențe"
                >
                  <InfoHint title="Context absențe" tip={s.context_note} />
                </span>
              )}
            </span>
            {/* the % alone is attackable — always show the denominator */}
            <span className="flex flex-col items-end flex-shrink-0">
              <span className="text-[13px] font-bold tabular-nums text-respins leading-tight">{Math.round(100 - s.presence_pct)}%</span>
              {s.chamber_votes ? (
                <span className="text-[9px] text-faint tabular-nums leading-tight">
                  din {s.chamber_votes} voturi
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between mt-2.5">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-[11px] px-2 py-1 rounded-md border border-rim text-muted disabled:opacity-40 hover:text-foreground transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-[11px] text-faint tabular-nums">{page + 1}/{pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
            disabled={page === pages - 1}
            className="text-[11px] px-2 py-1 rounded-md border border-rim text-muted disabled:opacity-40 hover:text-foreground transition-colors"
          >
            Următorii →
          </button>
        </div>
      )}
    </>
  )
}
