import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { pct, textOnColor } from '@/lib/utils'
import { DonutChart } from '@/components/donut-chart'
import type { PartyCohesion } from '@/lib/types'

export const revalidate = 3600
export const metadata: Metadata = { title: 'Partide', description: 'Coeziunea internă a partidelor din Parlamentul României.' }

export default async function PartiesPage() {
  const db = getDB()
  const { data: parties } = await db
    .from('party_cohesion')
    .select('*')
    .order('cohesion_pct', { ascending: false }) as { data: PartyCohesion[] | null }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Partide</h1>
      {!parties?.length ? (
        <p className="text-sm text-muted">Nu există date.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {parties.map(p => (
            <Link
              key={p.party_id}
              href={`/parties/${p.abbreviation}`}
              className="border border-rim rounded-xl p-5 bg-surface hover:bg-raised transition-colors block"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold"
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
                  <div className="text-2xl font-semibold tabular-nums text-foreground">
                    {p.votes_participated}
                  </div>
                  <div className="text-xs text-muted">Voturi</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-deviere">
                    {p.deviation_count}
                  </div>
                  <div className="text-xs text-muted">Devieri</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
