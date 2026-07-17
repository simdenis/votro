import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, choiceLabel, choiceColor, pct, hasPartyLine , personSlug } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { StatsCard } from '@/components/stats-card'
import { DonutChart } from '@/components/donut-chart'
import type { PartyCohesion, PoliticianStats, PartyMajorityVote } from '@/lib/types'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ abbr: string }> }): Promise<Metadata> {
  const { abbr } = await params
  const db = getDB()
  const { data } = await db.from('party_cohesion').select('name, abbreviation, cohesion_pct').eq('abbreviation', abbr.toUpperCase()).maybeSingle()
  if (!data) return { title: abbr.toUpperCase() }
  const desc = hasPartyLine(data.abbreviation)
    ? `Coeziune internă ${data.cohesion_pct != null ? `${data.cohesion_pct.toFixed(1)}%` : '—'}. Vezi cum au votat senatorii și deputații ${data.abbreviation}.`
    : `Vezi cum au votat parlamentarii din grupul ${data.name}.`
  return {
    title: `${data.abbreviation} — Coeziune și voturi`,
    description: desc,
    openGraph: { description: desc },
  }
}

export default async function PartyPage({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params
  const db = getDB()

  const [r0, r1, r2, r3, r4] = await Promise.all([
    db.from('party_cohesion').select('*').eq('abbreviation', abbr.toUpperCase()).maybeSingle(),
    db.from('senator_stats').select('politician_id, name, first_name, total_votes, deviation_pct').eq('party_abbr', abbr.toUpperCase()).eq('active', true).order('name'),
    db.from('deputy_stats').select('politician_id, name, first_name, total_votes, deviation_pct').eq('party_abbr', abbr.toUpperCase()).eq('active', true).order('name'),
    db.from('party_majority_votes').select('*').eq('party_abbr', abbr.toUpperCase())
      .order('vote_date', { ascending: false }).limit(20),
    db.from('party_absence').select('absence_pct').eq('abbreviation', abbr.toUpperCase()).maybeSingle(),
  ])

  const cohesion    = r0.data as PartyCohesion | null
  const senators    = r1.data as PoliticianStats[] | null
  const deputies    = r2.data as PoliticianStats[] | null
  const recentVotes = r3.data as PartyMajorityVote[] | null
  const absencePct  = (r4.data as { absence_pct: number | null } | null)?.absence_pct ?? null

  if (!cohesion) notFound()

  // IND/MIN are catch-all labels, not parties — no party line, so cohesion,
  // deviations and "party position" make no sense for them.
  const noLine = !hasPartyLine(cohesion.abbreviation)

  return (
    <div className="space-y-10">
      {/* Header */}
      <div
        className="bg-surface border border-rim rounded-2xl shadow-sm p-5 flex items-center gap-5"
        style={{ borderLeftWidth: 6, borderLeftColor: cohesion.color }}
      >
        <div className="flex-1 min-w-0">
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold text-white mb-2"
            style={{ backgroundColor: cohesion.color }}
          >
            {cohesion.abbreviation}
          </span>
          <h1 className="font-serif text-[34px] font-normal text-foreground leading-[1.05] tracking-tight">{cohesion.name}</h1>
          {noLine && (
            <p className="text-sm text-muted mt-1.5">
              Grup de parlamentari fără partid comun — nu există linie de partid, deci nu calculăm coeziune sau devieri.
            </p>
          )}
        </div>
        {!noLine && (
          <DonutChart
            segments={[
              { value: cohesion.cohesion_pct ?? 0,         color: cohesion.color },
              { value: 100 - (cohesion.cohesion_pct ?? 0), color: 'var(--rim)' },
            ]}
            size={84}
            ring={16}
            centerLabel={`${Math.round(cohesion.cohesion_pct ?? 0)}%`}
          />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {!noLine && <StatsCard value={pct(cohesion.cohesion_pct)} label="Coeziune" accent={cohesion.color} />}
        {!noLine && (
          <StatsCard
            value={cohesion.total_active_votes ? (cohesion.deviation_count / cohesion.total_active_votes * 100).toFixed(1) : '—'}
            label="Devieri / 100 voturi"
            accent="var(--color-deviation)"
          />
        )}
        {absencePct != null && (
          <StatsCard value={pct(absencePct)} label="Absență medie" accent="var(--color-against)" />
        )}
      </div>

      {/* Members — two columns: senators | deputies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-10">
      {[
        { label: 'Senatori', members: senators, basePath: '/senatori' },
        { label: 'Deputați',  members: deputies,  basePath: '/deputati' },
      ].map(({ label, members, basePath }) => (
        <div key={label}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
            {label} ({members?.length ?? 0})
          </h2>
          {!members?.length ? (
            <p className="text-sm text-muted">Nu există date.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="border-b-2 border-sidebar text-[11px] uppercase tracking-[0.14em] text-faint">
                    <th className="text-left py-2.5 px-3 font-medium">Nume</th>
                    <th className="text-right py-2.5 px-3 font-medium hidden md:table-cell">Voturi</th>
                    <th className="text-right py-2.5 px-3 font-medium">Devieri</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.politician_id} className="border-b border-rim hover:bg-raised transition-colors">
                      <td className="py-2.5 px-3">
                        <Link href={`${basePath}/${personSlug(m.first_name, m.name)}`} className="font-medium text-foreground hover:underline">
                          {m.first_name} {m.name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted tabular-nums hidden md:table-cell">
                        {m.total_votes}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {noLine ? (
                          <span className="text-faint" title="Fără linie de partid">—</span>
                        ) : (
                          <span className={m.deviation_pct != null && m.deviation_pct > 10 ? 'text-deviere font-bold' : 'text-muted'}>
                            {m.deviation_pct != null && m.deviation_pct > 10 && '⚠ '}
                            {pct(m.deviation_pct)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      </div>

      {/* Vote history — a "party position" only exists for real parties */}
      {!noLine && (
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
          Poziție partid (ultimele 20 voturi)
        </h2>
        {!recentVotes?.length ? (
          <p className="text-sm text-muted">Nu există date.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b-2 border-sidebar text-[11px] uppercase tracking-[0.14em] text-faint">
                  <th className="text-left py-2.5 px-3 font-medium">Cod</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden md:table-cell">Titlu</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden sm:table-cell">Dată</th>
                  <th className="text-left py-2.5 px-3 font-medium">Poziție partid</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden md:table-cell">Rezultat</th>
                </tr>
              </thead>
              <tbody>
                {recentVotes.map(v => (
                  <tr key={v.vote_id} className="border-b border-rim hover:bg-raised transition-colors">
                    <td className="py-2.5 px-3">
                      <Link href={`/voturi/${v.vote_id}`} className="font-mono hover:underline text-foreground">
                        {v.law_code}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-muted max-w-xs hidden md:table-cell">
                      <span className="line-clamp-1">{v.law_title}</span>
                    </td>
                    <td className="py-2.5 px-3 text-muted whitespace-nowrap hidden sm:table-cell">
                      {formatDate(v.vote_date)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold" style={{ color: choiceColor(v.majority_choice) }}>
                      {choiceLabel(v.majority_choice)}
                      <span className="text-abstention font-normal ml-2 tabular-nums">({v.majority_count})</span>
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell">
                      <OutcomeBadge outcome={v.outcome} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
