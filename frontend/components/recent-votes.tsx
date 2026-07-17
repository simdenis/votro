'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatDate, formatDateShort, capFirst, recessUntil } from '@/lib/utils'
import { CATEGORY_COLORS } from '@/lib/category-colors'
import { CategoryBadge } from '@/components/category-badge'
import { OutcomeBadge } from '@/components/outcome-badge'
import { InfoHint, METRIC_TIPS } from '@/components/info-hint'
import type { VoteWithLaw } from '@/lib/types'

type Field = 'recent' | 'hot'

const DAY = 86_400_000
const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS).sort((a, b) => a.localeCompare(b, 'ro'))

/**
 * Homepage vote browser: sort (Recente / Interes = laws.interest_score,
 * migration 025), a date slider that widens/narrows the window back from the
 * latest vote, and a multi-select category filter over ALL categories.
 */
export function RecentVotes({ votes }: { votes: VoteWithLaw[] }) {
  const [field, setField] = useState<Field>('recent')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<string[]>([])
  const [catOpen, setCatOpen] = useState(false)

  // Slider is relative to the newest vote (during recess "today" has no votes).
  const { newest, spanDays } = useMemo(() => {
    if (!votes.length) return { newest: 0, spanDays: 0 }
    let hi = -Infinity, lo = Infinity
    for (const v of votes) {
      const t = new Date(v.vote_date).getTime()
      if (t > hi) hi = t
      if (t < lo) lo = t
    }
    return { newest: hi, spanDays: Math.max(1, Math.ceil((hi - lo) / DAY) + 1) }
  }, [votes])

  const [days, setDays] = useState(0) // 0 until initialised below
  const maxDays = spanDays
  const effDays = days || Math.min(14, maxDays) // default: last 2 weeks of activity
  const cutoff = newest - (effDays - 1) * DAY

  const recentDesc = (a: VoteWithLaw, b: VoteWithLaw) =>
    new Date(b.vote_date).getTime() - new Date(a.vote_date).getTime()

  const visible = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1
    const filtered = votes.filter(v => {
      if (new Date(v.vote_date).getTime() < cutoff) return false
      if (selected.length && !(v.laws?.law_category && selected.includes(v.laws.law_category))) return false
      return true
    })
    return filtered.sort((a, b) => {
      if (field === 'hot') {
        const av = a.laws?.interest_score ?? -1, bv = b.laws?.interest_score ?? -1
        return av !== bv ? sign * (av - bv) : recentDesc(a, b)
      }
      return -sign * recentDesc(a, b)
    })
  }, [votes, field, dir, selected, cutoff])

  const last = votes[0]?.vote_date
  const quiet = last && Date.now() - new Date(last).getTime() > 7 * DAY
  const recess = quiet ? recessUntil() : null

  const arrow = dir === 'asc' ? '↑' : '↓'
  const pick = (f: Field) => { if (f === field) setDir(d => (d === 'asc' ? 'desc' : 'asc')); else { setField(f); setDir('desc') } }
  const Btn = ({ f, label }: { f: Field; label: string }) => (
    <button
      onClick={() => pick(f)}
      className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${field === f ? 'border-sidebar text-foreground font-medium' : 'border-rim text-muted hover:text-foreground'}`}
    >
      {label}{field === f ? ` ${arrow}` : ''}
    </button>
  )

  return (
    <>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-[11px] text-faint mr-0.5">Sortează:</span>
        <Btn f="recent" label="Recente" />
        <Btn f="hot" label="Interes" />
        <InfoHint title="Interes (scor AI)" tip={METRIC_TIPS.interes} />
        <button
          onClick={() => setCatOpen(o => !o)}
          className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${selected.length || catOpen ? 'border-sidebar text-foreground font-medium' : 'border-rim text-muted hover:text-foreground'}`}
        >
          {selected.length ? `Categorie (${selected.length})` : 'Categorie'} {catOpen ? '▴' : '▾'}
        </button>
      </div>

      {catOpen && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setSelected([])}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${!selected.length ? 'border-sidebar text-foreground font-medium' : 'border-rim text-muted hover:text-foreground'}`}
          >
            Toate
          </button>
          {ALL_CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setSelected(s => s.includes(c) ? s.filter(x => x !== c) : [...s, c])}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${selected.includes(c) ? 'border-sidebar text-foreground font-medium' : 'border-rim text-muted hover:text-foreground'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {maxDays > 7 && (
        <div className="flex items-center gap-3 mb-3 bg-surface border border-rim rounded-lg px-3 py-2">
          <span className="text-[11px] text-faint flex-shrink-0">Perioadă</span>
          <input
            type="range" min={7} max={maxDays} value={effDays}
            onChange={e => setDays(Math.max(7, +e.target.value))}
            className="flex-1 accent-[var(--sidebar-bg)]"
            aria-label="Perioadă afișată"
          />
          <span className="text-[11px] text-muted tabular-nums flex-shrink-0 min-w-[8.5rem] text-right">
            din {formatDateShort(new Date(cutoff).toISOString().slice(0, 10))}
          </span>
        </div>
      )}

      {recess && (
        <p className="text-[12.5px] text-muted bg-raised rounded-md px-3 py-2 mb-1">
          Parlamentul e în vacanță până la {recess} — de aceea nu apar voturi noi.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-[13px] text-muted py-3">Niciun vot pentru filtrele alese.</p>
      ) : visible.slice(0, 6).map(vote => (
        <Link key={vote.id} href={`/voturi/${vote.id}`} className="block py-[18px] border-b border-rim hover:opacity-80 transition-opacity">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--sidebar-bg)' }}>
              {vote.laws?.code ?? 'Plen'}
            </span>
            <span className="text-[9px] uppercase font-semibold bg-raised text-faint px-[5px] py-[1px] rounded-[3px]">
              {vote.chamber === 'deputies' ? 'Camera' : 'Senat'}
            </span>
            {vote.laws?.law_category && vote.laws?.summary_is_ai && (
              <CategoryBadge category={vote.laws.law_category} className="text-[9px] uppercase font-semibold px-[5px] py-[1px] rounded-[3px]" href={null} />
            )}
            <span className="text-[11px] text-faint ml-auto">{formatDate(vote.vote_date)}</span>
            <OutcomeBadge outcome={vote.outcome} />
          </div>
          {vote.laws?.summary ? (
            <>
              <h3 className="font-serif text-[17px] leading-[1.3] text-foreground line-clamp-2">{vote.laws.summary}</h3>
              <p className="flex items-center gap-1.5 text-[12px] text-faint mt-1 min-w-0">
                {vote.laws.summary_is_ai && (
                  <span className="text-[9px] uppercase font-semibold bg-raised px-[5px] py-[1px] rounded-[3px] flex-shrink-0">rezumat AI</span>
                )}
                <span className="truncate min-w-0 flex-1">{capFirst(vote.laws.title)}</span>
              </p>
            </>
          ) : (
            <h3 className="font-serif text-[17px] leading-[1.3] text-foreground line-clamp-1">
              {capFirst(vote.laws?.title ?? vote.description ?? '') || 'Vot procedural (fără lege identificată)'}
            </h3>
          )}
          <div className="flex items-center gap-3 mt-2.5">
            <div className="flex h-[6px] flex-1 rounded-[3px] overflow-hidden bg-raised">
              {(vote.for_count ?? 0) > 0 && <div style={{ flex: vote.for_count ?? 0, backgroundColor: 'var(--color-for)' }} />}
              {(vote.against_count ?? 0) > 0 && <div style={{ flex: vote.against_count ?? 0, backgroundColor: 'var(--color-against)' }} />}
              {(vote.abstention_count ?? 0) > 0 && <div style={{ flex: vote.abstention_count ?? 0, backgroundColor: 'var(--color-abstention)' }} />}
            </div>
            <span className="text-[12px] tabular-nums flex-shrink-0 font-medium">
              <span style={{ color: 'var(--color-for)' }}>{vote.for_count ?? 0} pentru</span>
              <span className="text-faint"> · </span>
              <span style={{ color: 'var(--color-against)' }}>{vote.against_count ?? 0} împotrivă</span>
              <span className="text-faint"> · </span>
              <span style={{ color: 'var(--color-abstention)' }}>{vote.abstention_count ?? 0} {(vote.abstention_count ?? 0) === 1 ? 'abținere' : 'abțineri'}</span>
            </span>
          </div>
        </Link>
      ))}
    </>
  )
}
