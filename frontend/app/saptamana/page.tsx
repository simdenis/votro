import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, formatDateShort, countNoun, capFirst, lastSessionRange } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { MiniVoteBar } from '@/components/mini-vote-bar'
import { CardDownload } from '@/components/card-download'
import type { VoteWithLaw } from '@/lib/types'
import { CategoryBadge } from '@/components/category-badge'

export const revalidate = 600 // ISR — CDN-cache for 10 min
export const metadata: Metadata = {
  title: 'Această săptămână',
  description: 'Voturile din ultimele 7 zile în Parlamentul României.',
}

export default async function SaptamanaPage() {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)

  const { data } = await getDB()
    .from('votes')
    .select('*, laws(*)')
    .gte('vote_date', since)
    .order('vote_date', { ascending: false })

  const votes = (data as VoteWithLaw[] | null) ?? []

  // Recess mode: an empty week during vacation gets the just-ended session in
  // numbers instead of a dead "no votes" message.
  const session = votes.length === 0 ? lastSessionRange() : null
  let sessionStats: { votes: number; adopted: number; rejected: number; deviations: number } | null = null
  if (session) {
    const db = getDB()
    const inRange = () => db.from('votes').select('id', { count: 'exact', head: true })
      .gte('vote_date', session.from).lte('vote_date', session.to)
    const [t, a, r, d] = await Promise.all([
      inRange(),
      inRange().eq('outcome', 'adoptat'),
      inRange().eq('outcome', 'respins'),
      db.from('politician_votes').select('id, votes!inner(vote_date)', { count: 'exact', head: true })
        .eq('party_line_deviation', true)
        .gte('votes.vote_date', session.from).lte('votes.vote_date', session.to),
    ])
    sessionStats = { votes: t.count ?? 0, adopted: a.count ?? 0, rejected: r.count ?? 0, deviations: d.count ?? 0 }
  }

  // Group by date
  const byDate = new Map<string, VoteWithLaw[]>()
  for (const v of votes) {
    const d = v.vote_date
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(v)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Această săptămână</h1>
        <span className="text-sm text-muted">{votes.length} {countNoun(votes.length, 'vot', 'voturi')}</span>
      </div>

      <div className="flex">
        <CardDownload
          href="/api/og/weekcard"
          filename={session ? 'labutoane-sesiune.png' : 'labutoane-saptamana.png'}
          label={session ? 'Card recap sesiune' : 'Card recap săptămânal'}
        />
      </div>

      {votes.length === 0 && !sessionStats && (
        <p className="text-sm text-muted py-8">
          Nu au fost voturi în ultimele 7 zile.
        </p>
      )}

      {session && sessionStats && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Parlamentul e în vacanță — sesiunea următoare începe în {session.label.startsWith('februarie') ? 'septembrie' : 'februarie'}.
            Între timp, sesiunea {session.label} în cifre:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t-2 border-sidebar">
            {[
              { value: sessionStats.votes,      label: 'voturi în plen',   color: 'var(--text)' },
              { value: sessionStats.adopted,    label: 'adoptate',         color: 'var(--color-for)' },
              { value: sessionStats.rejected,   label: 'respinse',         color: 'var(--color-against)' },
              { value: sessionStats.deviations, label: 'devieri de la partid', color: 'var(--color-deviation)' },
            ].map((s, i) => (
              <div key={s.label} className={`py-4 pr-4 ${i > 0 ? 'sm:border-l border-rim sm:pl-4' : ''}`}>
                <div className="text-[30px] font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[12px] text-muted mt-1.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-sm">
            <Link href={`/voturi?from=${session.from}&to=${session.to}`} className="text-muted hover:text-foreground underline underline-offset-2">
              Toate voturile sesiunii →
            </Link>
            <Link href="/legi" className="text-muted hover:text-foreground underline underline-offset-2">
              Legile urmărite →
            </Link>
          </div>
        </div>
      )}

      {Array.from(byDate.entries()).map(([date, dayVotes]) => (
        <div key={date} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted sticky top-0 bg-page py-1">
            {formatDate(date)} — {dayVotes.length} {countNoun(dayVotes.length, 'vot', 'voturi')}
          </h2>
          <div className="flex flex-col gap-2">
            {dayVotes.map(vote => (
              <Link
                key={vote.id}
                href={`/voturi/${vote.id}`}
                className="bg-surface border border-rim rounded-xl px-4 py-3.5 flex items-center gap-3 hover:-translate-y-px hover:shadow-sm transition-all"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor:
                    vote.outcome === 'adoptat' ? 'var(--color-for)' :
                    vote.outcome === 'respins' ? 'var(--color-against)' :
                    'var(--rim)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-muted font-semibold">
                      {vote.laws?.code ?? 'Plen'}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-faint bg-raised border border-rim rounded px-1.5 py-px">
                      {vote.chamber === 'deputies' ? 'Camera' : 'Senat'}
                    </span>
                    {vote.laws?.law_category && (
                      <CategoryBadge category={vote.laws.law_category} className="text-[10px] px-1.5 py-px rounded" href={null} />
                    )}
                    {vote.vote_type && (
                      <span className="text-[10px] text-faint">{vote.vote_type}</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground font-medium truncate">
                    {capFirst(vote.laws?.title ?? vote.description ?? '') || 'Vot de plen fără lege asociată'}
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <OutcomeBadge outcome={vote.outcome} />
                  <MiniVoteBar
                    forCount={vote.for_count}
                    againstCount={vote.against_count}
                    abstentionCount={vote.abstention_count}
                  />
                  <span className="text-[10px] text-muted tabular-nums">
                    <span className="text-adoptat font-semibold">{vote.for_count ?? 0}</span>
                    {' · '}
                    <span className="text-respins font-semibold">{vote.against_count ?? 0}</span>
                    {' · '}
                    <span className="text-[var(--color-abstention)] font-semibold">{vote.abstention_count ?? 0}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
