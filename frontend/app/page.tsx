import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { ParliamentBar } from '@/components/parliament-bar'
import { DonutChart } from '@/components/donut-chart'
import type { VoteWithLaw, PartyCohesion } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Acasă' }

export default async function Dashboard() {
  const db = getDB()

  const [r0, r1, r2, r3, r4, r5, r6] = await Promise.all([
    db.from('votes').select('*', { count: 'exact', head: true }),
    db.from('party_cohesion').select('*').gte('votes_participated', 3).order('cohesion_pct', { ascending: false }),
    db.from('votes').select('*, laws(*)').order('vote_date', { ascending: false }).limit(8),
    db.from('votes').select('*', { count: 'exact', head: true }).eq('outcome', 'adoptat'),
    db.from('votes').select('*', { count: 'exact', head: true }).eq('outcome', 'respins'),
    db.from('parties').select('abbreviation, color, name'),
    db.from('politicians').select('party_id, parties(abbreviation)', { count: 'exact', head: false }),
  ])

  const totalVotes    = r0.count ?? 0
  const cohesionData  = (r1.data as PartyCohesion[] | null) ?? []
  const recentVotes   = (r2.data as VoteWithLaw[] | null) ?? []
  const adoptedCount  = r3.count ?? 0
  const respinsCount  = r4.count ?? 0
  const allParties    = r5.data ?? []

  const knownOutcomes = adoptedCount + respinsCount
  const adoptedPct    = knownOutcomes > 0 ? Math.round((adoptedCount / knownOutcomes) * 100) : 0

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

      {/* ── Masthead ───────────────────────────────────────── */}
      <header className="border-b border-foreground/15 pb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted mb-1.5">
          Parlamentul României · Legislatura 2024
        </p>
        <h1 className="font-serif text-[2.1rem] font-semibold text-foreground leading-[1.05] tracking-tight">
          Cum votează Parlamentul
        </h1>
      </header>

      {/* ── Hero with depth + donut ───────────────────────── */}
      <div className="bg-surface border border-rim rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 flex items-center gap-6 flex-wrap">
          <div>
            <div className="font-serif text-5xl font-semibold text-foreground tabular-nums leading-none tracking-tight">
              {totalVotes}
            </div>
            <div className="text-sm text-muted mt-2">voturi înregistrate</div>
          </div>

          {knownOutcomes > 0 && (
            <div className="flex items-center gap-3 sm:ml-auto">
              <div className="relative">
                <DonutChart
                  segments={[
                    { value: adoptedPct,        color: '#22c55e' },
                    { value: 100 - adoptedPct,  color: '#ef4444' },
                  ]}
                  size={84}
                  ring={13}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-serif text-lg font-bold text-foreground leading-none">{adoptedPct}%</span>
                  <span className="text-[9px] text-muted uppercase tracking-wider">adopt.</span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="w-2 h-2 rounded-full bg-adoptat" /> Adoptate
                  <strong className="text-foreground tabular-nums">{adoptedCount}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="w-2 h-2 rounded-full bg-respins" /> Respinse
                  <strong className="text-foreground tabular-nums">{respinsCount}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="w-2 h-2 rounded-full bg-faint" /> Parlamentari
                  <strong className="text-foreground tabular-nums">{totalSenators}</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {parliamentParties.length > 0 && (
          <div className="px-5 py-4 border-t border-rim">
            <ParliamentBar parties={parliamentParties} total={totalSenators} />
          </div>
        )}
      </div>

      {/* ── Two columns ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-x-7 gap-y-8 items-start">

        {/* Recent votes */}
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground border-b border-foreground/15 pb-2 mb-4">
            Voturi recente
          </h2>
          <div className="flex flex-col gap-2.5">
            {recentVotes.map(vote => {
              const oc = vote.outcome === 'adoptat' ? '#22c55e' : vote.outcome === 'respins' ? '#ef4444' : 'var(--rim)'
              return (
                <Link
                  key={vote.id}
                  href={`/votes/${vote.id}`}
                  className="group block bg-surface border border-rim rounded-xl px-4 py-3 hover:-translate-y-px hover:shadow-md transition-all"
                  style={{ borderLeftWidth: 4, borderLeftColor: oc }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs text-muted font-semibold">{vote.laws?.code ?? '—'}</span>
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-foreground/60 bg-raised border border-rim rounded px-1.5 py-px">
                          {vote.chamber === 'deputies' ? 'Camera' : 'Senat'}
                        </span>
                        {vote.laws?.law_category && (
                          <span className="text-[10px] text-faint bg-raised border border-rim rounded px-1.5 py-px">
                            {vote.laws.law_category}
                          </span>
                        )}
                        <span className="text-[10px] text-faint ml-auto">{formatDate(vote.vote_date)}</span>
                      </div>
                      <p className="font-serif text-[17px] text-foreground leading-snug line-clamp-2 group-hover:underline decoration-foreground/30 underline-offset-2">
                        {vote.laws?.title ?? '—'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <OutcomeBadge outcome={vote.outcome} />
                    </div>
                  </div>

                  {/* Full-width vote breakdown bar */}
                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="flex h-3 flex-1 rounded-full overflow-hidden bg-raised"
                      title={`${vote.for_count ?? 0} pentru · ${vote.against_count ?? 0} împotrivă · ${vote.abstention_count ?? 0} abțineri`}
                    >
                      {(vote.for_count ?? 0) > 0 && <div style={{ flex: vote.for_count ?? 0, backgroundColor: '#22c55e' }} />}
                      {(vote.against_count ?? 0) > 0 && <div style={{ flex: vote.against_count ?? 0, backgroundColor: '#ef4444' }} />}
                      {(vote.abstention_count ?? 0) > 0 && <div style={{ flex: vote.abstention_count ?? 0, backgroundColor: '#8888cc' }} />}
                    </div>
                    <span className="text-xs text-muted tabular-nums flex-shrink-0 font-medium">
                      <span className="text-adoptat font-bold">{vote.for_count ?? 0}</span>
                      {' · '}
                      <span className="text-respins font-bold">{vote.against_count ?? 0}</span>
                      {' · '}
                      <span className="text-[#8888cc] font-bold">{vote.abstention_count ?? 0}</span>
                    </span>
                  </div>
                </Link>
              )
            })}
            {totalVotes > 8 && (
              <Link
                href="/votes"
                className="text-center text-sm text-muted py-3 border border-dashed border-rim rounded-xl hover:text-foreground hover:bg-raised/40 transition-colors"
              >
                Toate voturile →
              </Link>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-8">

          {/* Party cohesion */}
          {cohesionData.length > 0 && (
            <div>
              <h3 className="font-serif text-lg font-semibold text-foreground border-b border-foreground/15 pb-2 mb-3">
                Coeziune partide
              </h3>
              <div className="space-y-2.5">
                {cohesionData.map(c => (
                  <Link key={c.party_id} href={`/parties/${c.abbreviation}`} className="group block">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ backgroundColor: c.color, color: '#fff' }}
                      >
                        {c.abbreviation}
                      </span>
                      <span className="text-xs font-bold text-foreground tabular-nums">{c.cohesion_pct?.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-raised rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.cohesion_pct ?? 0}%`, backgroundColor: c.color }} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </aside>
      </div>
    </div>
  )
}
