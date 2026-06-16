import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, formatDateShort } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { MiniVoteBar } from '@/components/mini-vote-bar'
import { ParliamentBar } from '@/components/parliament-bar'
import { BaseLawBadges } from '@/components/base-law-badge'
import type { VoteWithLaw, PartyCohesion } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Acasă' }

function getWeekRange(offset: number): { from: string; to: string; label: string } {
  const now   = new Date()
  const day   = now.getUTCDay()
  const diff  = day === 0 ? -6 : 1 - day           // shift to Monday
  const mon   = new Date(now)
  mon.setUTCDate(now.getUTCDate() + diff + offset * 7)
  mon.setUTCHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setUTCDate(mon.getUTCDate() + 6)

  const fmt = (d: Date) =>
    d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' })

  return {
    from:  mon.toISOString().slice(0, 10),
    to:    sun.toISOString().slice(0, 10),
    label: `${fmt(mon)} – ${fmt(sun)} ${sun.getUTCFullYear()}`,
  }
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const sp         = await searchParams
  const weekOffset = Math.min(0, parseInt(sp.week ?? '0', 10) || 0)
  const { from, to, label } = getWeekRange(weekOffset)
  const isCurrentWeek = weekOffset === 0

  const db = getDB()

  const [r0, r1, r2, r3, r4, r5, r6, weekVotes] = await Promise.all([
    db.from('votes').select('*', { count: 'exact', head: true }),
    db.from('party_cohesion').select('*').gte('votes_participated', 3).order('cohesion_pct', { ascending: false }),
    db.from('votes').select('*', { count: 'exact', head: true }).eq('outcome', 'adoptat'),
    db.from('votes').select('*', { count: 'exact', head: true }).eq('outcome', 'respins'),
    db.from('parties').select('abbreviation, color, name'),
    db.from('politicians').select('party_id, parties(abbreviation)', { count: 'exact', head: false }),
    db.from('votes').select('scraped_at').order('scraped_at', { ascending: false }).limit(1),
    db.from('votes')
      .select('*, laws(*)')
      .gte('vote_date', from)
      .lte('vote_date', to)
      .order('vote_date', { ascending: false }),
  ])

  const totalVotes   = r0.count ?? 0
  const cohesionData = (r1.data as PartyCohesion[] | null) ?? []
  const adoptedCount = r2.count ?? 0
  const respinsCount = r3.count ?? 0
  const allParties   = r4.data ?? []
  const votes        = (weekVotes.data as VoteWithLaw[] | null) ?? []

  const knownOutcomes = adoptedCount + respinsCount
  const adoptedPct    = knownOutcomes > 0 ? Math.round((adoptedCount / knownOutcomes) * 100) : 0

  const senatorCounts: Record<string, number> = {}
  for (const p of (r5.data ?? []) as any[]) {
    const abbr = p.parties?.abbreviation
    if (abbr) senatorCounts[abbr] = (senatorCounts[abbr] ?? 0) + 1
  }
  const parliamentParties = allParties
    .map(p => ({ ...p, senator_count: senatorCounts[p.abbreviation] ?? 0 }))
    .filter(p => p.senator_count > 0)
    .sort((a, b) => b.senator_count - a.senator_count)
  const totalSenators = parliamentParties.reduce((s, p) => s + p.senator_count, 0)

  // Group week votes by date
  const byDate = new Map<string, VoteWithLaw[]>()
  for (const v of votes) {
    if (!byDate.has(v.vote_date)) byDate.set(v.vote_date, [])
    byDate.get(v.vote_date)!.push(v)
  }

  const prevUrl = `/?week=${weekOffset - 1}`
  const nextUrl = weekOffset < 0 ? `/?week=${weekOffset + 1}` : null

  return (
    <div className="space-y-8">

      {/* ── Stats hero ────────────────────────────────── */}
      <div className="bg-surface border border-rim rounded-xl p-6">
        <div className="flex items-end justify-between gap-6 flex-wrap mb-5">
          <div>
            <div className="text-5xl font-extrabold text-foreground tabular-nums leading-none tracking-tight">
              {totalVotes}
            </div>
            <div className="text-sm text-muted mt-1.5">voturi înregistrate</div>
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
                <div className="text-xs text-muted uppercase tracking-widest mt-1">parlamentari</div>
              </div>
            </div>
          )}
        </div>
        {parliamentParties.length > 0 && (
          <ParliamentBar parties={parliamentParties} total={totalSenators} />
        )}
      </div>

      {/* ── Weekly feed ───────────────────────────────── */}
      <div className="space-y-5">

        {/* Week header + nav */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isCurrentWeek ? 'Această săptămână' : 'Săptămâna'}
            </h2>
            <p className="text-xs text-muted mt-0.5">{label}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={prevUrl}
              className="px-3 py-1.5 text-xs border border-rim rounded-lg text-muted hover:text-foreground hover:bg-raised transition-colors"
            >
              ← Anterior
            </Link>
            {nextUrl ? (
              <Link
                href={nextUrl}
                className="px-3 py-1.5 text-xs border border-rim rounded-lg text-muted hover:text-foreground hover:bg-raised transition-colors"
              >
                Următor →
              </Link>
            ) : (
              <span className="px-3 py-1.5 text-xs border border-rim rounded-lg text-faint cursor-default">
                Următor →
              </span>
            )}
          </div>
        </div>

        {votes.length === 0 && (
          <p className="text-sm text-muted py-8 text-center border border-dashed border-rim rounded-xl">
            Nu au fost voturi în această perioadă.
          </p>
        )}

        {Array.from(byDate.entries()).map(([date, dayVotes]) => (
          <div key={date} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              {formatDate(date)} — {dayVotes.length} {dayVotes.length === 1 ? 'vot' : 'voturi'}
            </p>
            <div className="flex flex-col gap-2">
              {dayVotes.map(vote => (
                <Link
                  key={vote.id}
                  href={`/votes/${vote.id}`}
                  className="bg-surface border border-rim rounded-xl px-4 py-3.5 flex items-center gap-3 hover:-translate-y-px hover:shadow-sm transition-all"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor:
                      vote.outcome === 'adoptat' ? '#22c55e' :
                      vote.outcome === 'respins' ? '#ef4444' :
                      'var(--rim)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-muted font-semibold">
                        {vote.laws?.code ?? '—'}
                      </span>
                      {vote.laws?.law_category && (
                        <span className="text-[10px] text-faint bg-raised border border-rim rounded px-1.5 py-px">
                          {vote.laws.law_category}
                        </span>
                      )}
                      {vote.laws?.title && (
                        <BaseLawBadges title={vote.laws.title} />
                      )}
                    </div>
                    <p className="text-sm text-foreground font-medium truncate">
                      {vote.laws?.title ?? '—'}
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
                      <span className="text-[#8888cc] font-semibold">{vote.abstention_count ?? 0}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
