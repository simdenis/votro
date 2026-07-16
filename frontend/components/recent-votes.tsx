'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatDate, capFirst, recessUntil } from '@/lib/utils'
import { CategoryBadge } from '@/components/category-badge'
import { OutcomeBadge } from '@/components/outcome-badge'
import type { VoteWithLaw } from '@/lib/types'

type Field = 'recent' | 'hot'

/**
 * Homepage vote feed: sort by Recente or Interes (laws.interest_score, Gemini
 * 1–100, migration 025) with a ↑↓ toggle, plus a category *filter* that reveals
 * the category list when opened. Votes arrive recent-first from the server.
 */
export function RecentVotes({ votes }: { votes: VoteWithLaw[] }) {
  const [field, setField] = useState<Field>('recent')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [category, setCategory] = useState('')
  const [catOpen, setCatOpen] = useState(false)

  function pick(f: Field) {
    if (f === field) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setField(f); setDir('desc') }
  }

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const v of votes) if (v.laws?.law_category) set.add(v.laws.law_category)
    return [...set].sort((a, b) => a.localeCompare(b, 'ro'))
  }, [votes])

  const recentDesc = (a: VoteWithLaw, b: VoteWithLaw) =>
    new Date(b.vote_date).getTime() - new Date(a.vote_date).getTime()

  const visible = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1
    const filtered = category ? votes.filter(v => v.laws?.law_category === category) : votes
    return [...filtered].sort((a, b) => {
      if (field === 'hot') {
        const av = a.laws?.interest_score ?? -1, bv = b.laws?.interest_score ?? -1
        return av !== bv ? sign * (av - bv) : recentDesc(a, b)
      }
      return -sign * recentDesc(a, b)
    })
  }, [votes, field, dir, category])

  // A week without votes reads as "abandoned" when it's really recess
  const last = votes[0]?.vote_date
  const quiet = last && Date.now() - new Date(last).getTime() > 7 * 86_400_000
  const recess = quiet ? recessUntil() : null

  const arrow = dir === 'asc' ? '↑' : '↓'
  const Btn = ({ f, label }: { f: Field; label: string }) => (
    <button
      onClick={() => pick(f)}
      className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
        field === f ? 'border-sidebar text-foreground font-medium' : 'border-rim text-muted hover:text-foreground'
      }`}
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
        {categories.length > 0 && (
          <button
            onClick={() => setCatOpen(o => !o)}
            className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
              category || catOpen ? 'border-sidebar text-foreground font-medium' : 'border-rim text-muted hover:text-foreground'
            }`}
          >
            {category || 'Categorie'} {catOpen ? '▴' : '▾'}
          </button>
        )}
      </div>

      {catOpen && categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setCategory('')}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${!category ? 'border-sidebar text-foreground font-medium' : 'border-rim text-muted hover:text-foreground'}`}
          >
            Toate
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c === category ? '' : c)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${category === c ? 'border-sidebar text-foreground font-medium' : 'border-rim text-muted hover:text-foreground'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {recess && (
        <p className="text-[12.5px] text-muted bg-raised rounded-md px-3 py-2 mb-1">
          Parlamentul e în vacanță până la {recess} — de aceea nu apar voturi noi.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-[13px] text-muted py-3">Niciun vot în categoria „{category}".</p>
      ) : visible.map(vote => (
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
