import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, choiceLabel, choiceColor, pct } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { StatsCard } from '@/components/stats-card'
import { DonutChart } from '@/components/donut-chart'
import type { PartyCohesion, SenatorStats, PartyMajorityVote } from '@/lib/types'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ abbr: string }> }): Promise<Metadata> {
  const { abbr } = await params
  const db = getDB()
  const { data } = await db.from('party_cohesion').select('name, abbreviation, cohesion_pct').eq('abbreviation', abbr.toUpperCase()).maybeSingle()
  if (!data) return { title: abbr.toUpperCase() }
  const desc = `Coeziune internă ${data.cohesion_pct != null ? `${data.cohesion_pct.toFixed(1)}%` : '—'}. Vezi cum au votat senatorii și deputații ${data.abbreviation}.`
  return {
    title: `${data.abbreviation} — Coeziune și voturi`,
    description: desc,
    openGraph: { description: desc },
  }
}

export default async function PartyPage({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params
  const db = getDB()

  const [r0, r1, r2] = await Promise.all([
    db.from('party_cohesion').select('*').eq('abbreviation', abbr.toUpperCase()).maybeSingle(),
    db.from('senator_stats').select('*').eq('party_abbr', abbr.toUpperCase()).order('name'),
    db.from('party_majority_votes').select('*').eq('party_abbr', abbr.toUpperCase())
      .order('vote_date', { ascending: false }).limit(20),
  ])

  const cohesion    = r0.data as PartyCohesion | null
  const members     = r1.data as SenatorStats[] | null
  const recentVotes = r2.data as PartyMajorityVote[] | null

  if (!cohesion) notFound()

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center gap-6">
        <div className="border-l-4 pl-4" style={{ borderColor: cohesion.color }}>
          <h1 className="text-3xl font-semibold text-foreground">{cohesion.name}</h1>
          <span className="text-sm text-muted">{cohesion.abbreviation} · Senat</span>
        </div>
        <DonutChart
          segments={[
            { value: cohesion.cohesion_pct ?? 0,         color: cohesion.color },
            { value: 100 - (cohesion.cohesion_pct ?? 0), color: 'var(--rim)' },
          ]}
          size={80}
          ring={16}
          centerLabel={`${Math.round(cohesion.cohesion_pct ?? 0)}%`}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatsCard value={pct(cohesion.cohesion_pct)} label="Coeziune" accent={cohesion.color} />
        <StatsCard value={cohesion.votes_participated} label="Voturi" />
        <StatsCard value={cohesion.deviation_count} label="Devieri totale" accent="#f59e0b" />
      </div>

      {/* Members */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
          Senatori ({members?.length ?? 0})
        </h2>
        {!members?.length ? (
          <p className="text-sm text-muted">Nu există date.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rim text-xs uppercase tracking-widest text-muted">
                  <th className="text-left py-2 pr-4 font-medium">Nume</th>
                  <th className="text-right py-2 pr-4 font-medium hidden md:table-cell">Voturi</th>
                  <th className="text-right py-2 font-medium">Devieri</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.politician_id} className="border-b border-rim hover:bg-raised transition-colors">
                    <td className="py-2.5 pr-4">
                      <Link href={`/senators/${m.politician_id}`} className="text-foreground hover:underline">
                        {m.first_name} {m.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-muted tabular-nums hidden md:table-cell">
                      {m.total_votes}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span className={m.deviation_pct != null && m.deviation_pct > 10 ? 'text-deviere font-semibold' : 'text-muted'}>
                        {m.deviation_pct != null && m.deviation_pct > 10 && '⚠ '}
                        {pct(m.deviation_pct)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vote history */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
          Poziție partid (ultimele 20 voturi)
        </h2>
        {!recentVotes?.length ? (
          <p className="text-sm text-muted">Nu există date.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rim text-xs uppercase tracking-widest text-muted">
                  <th className="text-left py-2 pr-4 font-medium">Cod</th>
                  <th className="text-left py-2 pr-4 font-medium hidden md:table-cell">Titlu</th>
                  <th className="text-left py-2 pr-4 font-medium hidden sm:table-cell">Dată</th>
                  <th className="text-left py-2 pr-4 font-medium">Poziție partid</th>
                  <th className="text-left py-2 font-medium hidden md:table-cell">Rezultat</th>
                </tr>
              </thead>
              <tbody>
                {recentVotes.map(v => (
                  <tr key={v.vote_id} className="border-b border-rim hover:bg-raised transition-colors">
                    <td className="py-2.5 pr-4">
                      <Link href={`/votes/${v.vote_id}`} className="font-mono hover:underline text-foreground">
                        {v.law_code}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-muted max-w-xs hidden md:table-cell">
                      <span className="line-clamp-1">{v.law_title}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted whitespace-nowrap hidden sm:table-cell">
                      {formatDate(v.vote_date)}
                    </td>
                    <td className="py-2.5 pr-4 font-medium" style={{ color: choiceColor(v.majority_choice) }}>
                      {choiceLabel(v.majority_choice)}
                      <span className="text-[#5050a0] font-normal ml-2 tabular-nums">({v.majority_count})</span>
                    </td>
                    <td className="py-2.5 hidden md:table-cell">
                      <OutcomeBadge outcome={v.outcome} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
