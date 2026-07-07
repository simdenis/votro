import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, countNoun, hasPartyLine } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { ParliamentBar } from '@/components/parliament-bar'
import type { VoteWithLaw, PartyCohesion } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Acasă' }

export default async function Dashboard() {
  const db = getDB()

  const [r0, r1, r2, r3, r4, r5, r6] = await Promise.all([
    db.from('law_status').select('*', { count: 'exact', head: true }),
    db.from('party_cohesion').select('*').gte('votes_participated', 3).order('cohesion_pct', { ascending: false }),
    db.from('votes').select('*, laws(*)').order('vote_date', { ascending: false }).limit(8),
    db.from('law_status').select('*', { count: 'exact', head: true }).eq('presidential_status', 'promulgat'),
    db.from('law_status').select('*', { count: 'exact', head: true }).or('senate_outcome.eq.respins,camera_outcome.eq.respins'),
    db.from('parties').select('abbreviation, color, name'),
    db.from('politicians').select('party_id, parties(abbreviation)', { count: 'exact', head: false }).eq('active', true),
  ])

  const totalLaws     = r0.count ?? 0
  // IND/MIN are catch-all labels, not parties — "cohesion" is meaningless there
  const cohesionData  = ((r1.data as PartyCohesion[] | null) ?? []).filter(c => hasPartyLine(c.abbreviation))
  const recentVotes   = (r2.data as VoteWithLaw[] | null) ?? []
  const promulgatedCount = r3.count ?? 0
  const respinsCount  = r4.count ?? 0
  const allParties    = r5.data ?? []

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

  const stats = [
    { value: totalLaws,        label: 'legi urmărite', color: 'var(--text)' },
    { value: promulgatedCount, label: 'promulgate',    color: 'var(--color-for)' },
    { value: respinsCount,     label: 'respinse',      color: 'var(--color-against)' },
  ]

  return (
    <div>

      {/* ── Header ───────────────────────────────────────── */}
      <header className="mb-9">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint mb-2.5">
          Parlamentul României · Legislatura 2026
        </p>
        <h1 className="font-serif text-[42px] font-normal tracking-[-0.01em] leading-[1.04] text-foreground">
          Cum votează Parlamentul
        </h1>
      </header>

      {/* ── Stats row ────────────────────────────────────── */}
      <section className="grid grid-cols-3 border-t-2 border-sidebar mb-12">
        {stats.map((s, i) => (
          <div key={s.label} className={`py-5 pr-6 ${i > 0 ? 'border-l border-rim pl-4 sm:pl-6' : ''}`}>
            <div className="text-[36px] font-bold tabular-nums tracking-[-0.02em] leading-none" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[12px] text-muted mt-2 font-medium">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Parliament composition ───────────────────────── */}
      {parliamentParties.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-3.5">
            <h2 className="font-serif text-[20px] font-normal text-foreground">Componența Parlamentului</h2>
            <span className="text-[12.5px] text-muted">{totalSenators} <span className="font-semibold">{countNoun(totalSenators, 'parlamentar', 'parlamentari')}</span></span>
          </div>
          <ParliamentBar parties={parliamentParties} total={totalSenators} />
        </section>
      )}

      {/* ── Vote list + cohesion sidebar ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-x-12 gap-y-10 items-start">

        {/* Recent votes */}
        <section>
          <h2 className="font-serif text-[20px] font-normal text-foreground border-b-2 border-sidebar pb-[5px] mb-2">
            Voturi recente
          </h2>
          {recentVotes.map(vote => {
            const tot = (vote.for_count ?? 0) + (vote.against_count ?? 0) + (vote.abstention_count ?? 0)
            return (
              <Link key={vote.id} href={`/votes/${vote.id}`} className="block py-[18px] border-b border-rim hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--sidebar-bg)' }}>
                    {vote.laws?.code ?? 'Plen'}
                  </span>
                  <span className="text-[9px] uppercase font-semibold bg-raised text-faint px-[5px] py-[1px] rounded-[3px]">
                    {vote.chamber === 'deputies' ? 'Camera' : 'Senat'}
                  </span>
                  {vote.laws?.law_category && (
                    <span className="text-[9px] uppercase font-semibold bg-raised text-faint px-[5px] py-[1px] rounded-[3px]">
                      {vote.laws.law_category}
                    </span>
                  )}
                  <span className="text-[11px] text-faint ml-auto">{formatDate(vote.vote_date)}</span>
                  <OutcomeBadge outcome={vote.outcome} />
                </div>
                <h3 className="font-serif text-[18px] leading-[1.32] text-foreground line-clamp-2">
                  {vote.laws?.title ?? vote.description ?? 'Vot de plen fără lege asociată'}
                </h3>
                <div className="flex items-center gap-3 mt-2.5">
                  <div className="flex h-[6px] flex-1 rounded-[3px] overflow-hidden bg-raised">
                    {(vote.for_count ?? 0) > 0 && <div style={{ flex: vote.for_count ?? 0, backgroundColor: 'var(--color-for)' }} />}
                    {(vote.against_count ?? 0) > 0 && <div style={{ flex: vote.against_count ?? 0, backgroundColor: 'var(--color-against)' }} />}
                    {(vote.abstention_count ?? 0) > 0 && <div style={{ flex: vote.abstention_count ?? 0, backgroundColor: 'var(--color-abstention)' }} />}
                  </div>
                  <span className="text-[12px] tabular-nums flex-shrink-0 font-medium">
                    <span style={{ color: 'var(--color-for)' }}>{vote.for_count ?? 0}</span>
                    <span className="text-faint"> · </span>
                    <span style={{ color: 'var(--color-against)' }}>{vote.against_count ?? 0}</span>
                    <span className="text-faint"> · </span>
                    <span style={{ color: 'var(--color-abstention)' }}>{vote.abstention_count ?? 0}</span>
                  </span>
                </div>
              </Link>
            )
          })}
          {totalVotes > 8 && (
            <Link href="/votes" className="inline-block mt-5 text-[13px] text-muted hover:text-foreground transition-colors">
              Toate voturile →
            </Link>
          )}
        </section>

        {/* Cohesion sidebar */}
        {cohesionData.length > 0 && (
          <aside>
            <h2 className="font-serif text-[16px] font-normal text-foreground border-b-2 border-sidebar pb-[5px] mb-4">
              Coeziune partide
            </h2>
            <div className="space-y-2">
              {cohesionData.map(c => (
                <Link
                  key={c.party_id}
                  href={`/parties/${c.abbreviation}`}
                  className="flex items-center justify-between bg-surface border border-rim rounded-lg px-3 py-2 hover:bg-raised transition-colors"
                  style={{ borderLeftWidth: 3, borderLeftColor: c.color }}
                >
                  <span className="text-[13px] font-medium text-foreground">{c.abbreviation}</span>
                  <span className="text-[13px] font-semibold tabular-nums text-foreground">{c.cohesion_pct?.toFixed(0)}%</span>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
