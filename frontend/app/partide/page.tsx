import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { pct, textOnColor, hasPartyLine } from '@/lib/utils'
import { InfoHint, METRIC_TIPS } from '@/components/info-hint'
import type { PartyCohesion, PartyAbsence } from '@/lib/types'

export const revalidate = 3600
export const metadata: Metadata = { title: 'Partide', description: 'Numărul de membri, rata de deviere și absența medie a partidelor din Parlamentul României.' }

export default async function PartiesPage() {
  const db = getDB()
  const [r0, r1, r2] = await Promise.all([
    db.from('party_cohesion')
      .select('*')
      .gt('votes_participated', 0)
      .order('votes_participated', { ascending: false }),
    db.from('party_absence').select('*'),
    db.from('politicians').select('party_id').eq('active', true),
  ])
  const data = r0.data as PartyCohesion[] | null
  // IND/MIN are catch-all labels, not parties — "cohesion" is meaningless there
  const parties = data?.filter(p => hasPartyLine(p.abbreviation))
  const absenceByParty: Record<string, number | null> = {}
  for (const a of (r1.data ?? []) as PartyAbsence[]) absenceByParty[a.party_id] = a.absence_pct
  // Member count per party — cohesion was ~identical for everyone (92–99%), so
  // the donut said nothing; party size is the legible, distinguishing number.
  const membersByParty: Record<string, number> = {}
  for (const row of (r2.data ?? []) as { party_id: string }[]) {
    membersByParty[row.party_id] = (membersByParty[row.party_id] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Partide</h1>
        <p className="text-[12.5px] text-muted mt-1.5">
          Numărul de membri activi,{' '}
          <InfoHint title="Devieri / 100 voturi" tip={METRIC_TIPS.devieri}>
            <span className="font-semibold text-foreground underline decoration-dotted decoration-rim underline-offset-2">rata de deviere</span>
          </InfoHint>{' '}
          de la linia de partid și{' '}
          <InfoHint title="Absență medie" tip={METRIC_TIPS.absenta}>
            <span className="font-semibold text-foreground underline decoration-dotted decoration-rim underline-offset-2">absența medie</span>
          </InfoHint>{' '}
          — pe baza <strong className="text-foreground">afilierii curente</strong> a parlamentarilor.
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
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-foreground">
                    {membersByParty[p.party_id] ?? '—'}
                  </div>
                  <div className="text-xs text-muted">Membri</div>
                </div>
                {/* rate, not raw count — raw deviations scale with member count ×
                    votes cast, so big present parties look worse than they are */}
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-deviere">
                    {p.total_active_votes ? (p.deviation_count / p.total_active_votes * 100).toFixed(1) : '—'}
                  </div>
                  <div className="text-xs text-muted">Devieri / 100 voturi</div>
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
