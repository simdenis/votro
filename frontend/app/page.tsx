import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { MiniVoteBar } from '@/components/mini-vote-bar'
import { ParliamentBar } from '@/components/parliament-bar'
import type { VoteWithLaw, PartyCohesion } from '@/lib/types'

export const revalidate = 1800
export const metadata: Metadata = { title: 'Acasă' }

export default async function Dashboard() {
  const db = getDB()

  const [r0, r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
    db.from('votes').select('*', { count: 'exact', head: true }),
    db.from('party_cohesion')
      .select('*')
      .gte('votes_participated', 3)
      .order('cohesion_pct', { ascending: false }),
    db.from('votes')
      .select('*, laws(*)')
      .order('vote_date', { ascending: false })
      .limit(8),
    db.from('votes').select('*', { count: 'exact', head: true }).eq('outcome', 'adoptat'),
    db.from('votes').select('*', { count: 'exact', head: true }).eq('outcome', 'respins'),
    db.from('parties').select('abbreviation, color, name'),
    db.from('politicians').select('party_id, parties(abbreviation)', { count: 'exact', head: false }),
    db.from('votes').select('vote_date').order('vote_date', { ascending: false }).limit(1),
  ])

  const totalVotes    = r0.count ?? 0
  const cohesionData  = (r1.data as PartyCohesion[] | null) ?? []
  const recentVotes   = (r2.data as VoteWithLaw[] | null) ?? []
  const adoptedCount  = r3.count ?? 0
  const respinsCount  = r4.count ?? 0
  const allParties    = r5.data ?? []
  const lastVoteDate  = r7.data?.[0]?.vote_date as string | undefined
  const isStale       = lastVoteDate
    ? (Date.now() - new Date(lastVoteDate).getTime()) > 48 * 60 * 60 * 1000
    : false

  const knownOutcomes = adoptedCount + respinsCount
  const adoptedPct    = knownOutcomes > 0 ? Math.round((adoptedCount / knownOutcomes) * 100) : 0

  // Build senator counts per party from politicians table
  const senatorCounts: Record<string, number> = {}
  for (const p of (r6.data ?? []) as any[]) {
    const abbr = p.parties?.abbreviation
    if (abbr) senatorCounts[abbr] = (senatorCounts[abbr] ?? 0) + 1
  }

  const parliamentParties = allParties
    .map(p => ({ ...p, senator_count: senatorCounts[p.abbreviation] ?? 0 }))
    .filter(p => p.senator_count > 0)
    .sort((a, b) => b.senator_count - a.senator_count)

  const totalSenators = parliamentParties.reduce((s, p) => s + p.senator_count, 0)

  return (
    <div className="space-y-8">

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="bg-surface border border-rim rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-muted">Sesiunea curentă</p>
          {lastVoteDate && (
            <p className={`text-xs ${isStale ? 'text-deviere' : 'text-muted'}`}>
              Ultima actualizare: {formatDate(lastVoteDate)}
              {isStale && ' ⚠'}
            </p>
          )}
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <div>
            <div className="text-5xl font-extrabold text-foreground tabular-nums leading-none tracking-tight">
              {totalVotes}
            </div>
            <div className="text-sm text-muted mt-1.5">voturi înregistrate în Senat</div>
          </div>
          {knownOutcomes > 0 && (
            <div className="flex gap-8">
              <div className="text-right">
                <div className="text-3xl font-extrabold text-adoptat tabular-nums leading-none">{adoptedPct}%</div>
                <div className="text-xs text-muted uppercase tracking-widest mt-1">adoptate</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-respins tabular-nums leading-none">{100 - adoptedPct}%</div>
                <div className="text-xs text-muted uppercase tracking-widest mt-1">respinse</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-foreground tabular-nums leading-none">{totalSenators}</div>
                <div className="text-xs text-muted uppercase tracking-widest mt-1">senatori</div>
              </div>
            </div>
          )}
        </div>

        {/* Parliament composition bar */}
        {parliamentParties.length > 0 && (
          <ParliamentBar parties={parliamentParties} total={totalSenators} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_256px] gap-6 items-start">

        {/* ── Recent votes ───────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            Voturi recente
          </h2>
          <div className="flex flex-col gap-2">
            {recentVotes.map(vote => (
              <Link
                key={vote.id}
                href={`/votes/${vote.id}`}
                className="bg-surface border border-rim rounded-xl px-4 py-3.5 flex items-center gap-3 hover:-translate-y-px hover:shadow-sm transition-all"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: vote.outcome === 'adoptat' ? '#22c55e' : vote.outcome === 'respins' ? '#ef4444' : 'var(--rim)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-muted font-semibold">{vote.laws?.code ?? '—'}</span>
                    {vote.laws?.law_category && (
                      <span className="text-[10px] text-faint bg-raised border border-rim rounded px-1.5 py-px">
                        {vote.laws.law_category}
                      </span>
                    )}
                    <span className="text-[10px] text-faint ml-auto">{formatDate(vote.vote_date)}</span>
                  </div>
                  <p className="text-sm text-foreground font-medium truncate">{vote.laws?.title ?? '—'}</p>
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
                    <span className="text-[#8888cc] font-semibold">{vote.abstention_count ?? 0}</span>
                  </span>
                </div>
              </Link>
            ))}
            {totalVotes > 8 && (
              <Link
                href="/votes"
                className="text-center text-sm text-muted py-3 border border-dashed border-rim rounded-xl hover:text-foreground transition-colors"
              >
                Toate voturile →
              </Link>
            )}
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Party cohesion */}
          {cohesionData.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                Coeziune partide
              </h2>
              <div className="bg-surface border border-rim rounded-xl p-4 space-y-3">
                {cohesionData.map(c => (
                  <div key={c.party_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <Link href={`/parties/${c.abbreviation}`}>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold hover:opacity-75 transition-opacity"
                          style={{ backgroundColor: c.color, color: '#fff' }}
                        >
                          {c.abbreviation}
                        </span>
                      </Link>
                      <span className="text-xs font-bold text-foreground tabular-nums">
                        {c.cohesion_pct?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1 bg-raised rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.cohesion_pct ?? 0}%`, backgroundColor: c.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
