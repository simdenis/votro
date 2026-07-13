import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { pct, textOnColor, hasPartyLine } from '@/lib/utils'
import { DonutChart } from '@/components/donut-chart'
import type { PartyCohesion, PartyAbsence } from '@/lib/types'

export const revalidate = 3600
export const metadata: Metadata = { title: 'Partide', description: 'Coeziunea internă și absența medie a partidelor din Parlamentul României.' }

export default async function PartiesPage() {
  const db = getDB()
  const [r0, r1] = await Promise.all([
    db.from('party_cohesion')
      .select('*')
      .gt('votes_participated', 0)
      .order('votes_participated', { ascending: false }),
    db.from('party_absence').select('*'),
  ])
  const data = r0.data as PartyCohesion[] | null
  // IND/MIN are catch-all labels, not parties — "cohesion" is meaningless there
  const parties = data?.filter(p => hasPartyLine(p.abbreviation))
  const absenceByParty: Record<string, number | null> = {}
  for (const a of (r1.data ?? []) as PartyAbsence[]) absenceByParty[a.party_id] = a.absence_pct

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Partide</h1>
        <p className="text-[12.5px] text-muted mt-1.5">
          Coeziunea se calculează pe baza <strong className="text-foreground">afilierii curente</strong> a
          parlamentarilor, doar pe <strong className="text-foreground">voturile disputate</strong> (tabăra
          minoritară ≥ 20% din voturile exprimate) — voturile aproape unanime nu diferențiază partidele.
        </p>
      </div>
      {!parties?.length ? (
        <p className="text-sm text-muted">Nu există date.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {parties.map(p => (
            <Link
              key={p.party_id}
              href={`/partide/${p.abbreviation}`}
              className="border border-rim rounded-xl p-5 bg-surface hover:bg-raised transition-colors block"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span
                    className="inline-flex items-center rounded-[4px] px-2.5 py-1 text-sm font-semibold"
                    style={{ backgroundColor: p.color, color: textOnColor(p.color) }}
                  >
                    {p.abbreviation}
                  </span>
                  <div className="text-sm text-muted mt-1.5 line-clamp-1">{p.name}</div>
                </div>
                <DonutChart
                  segments={[
                    { value: p.cohesion_pct ?? 0,           color: p.color },
                    { value: 100 - (p.cohesion_pct ?? 0),   color: 'var(--rim)' },
                  ]}
                  size={64}
                  ring={14}
                />
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-foreground">
                    {pct(p.cohesion_pct)}
                  </div>
                  <div className="text-xs text-muted">Coeziune</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-deviere">
                    {p.deviation_count}
                  </div>
                  <div className="text-xs text-muted">Devieri</div>
                </div>
                {absenceByParty[p.party_id] != null && (
                  <div>
                    <div className="text-2xl font-semibold tabular-nums text-foreground">
                      {pct(absenceByParty[p.party_id])}
                    </div>
                    <div className="text-xs text-muted">Absență medie</div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
