import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { PartyBadge } from '@/components/party-badge'
import { hasPartyLine , personSlug } from '@/lib/utils'
import { CountyMap } from '@/components/county-map'
import { ScrollIntoView } from '@/components/scroll-into-view'
import type { PoliticianStats } from '@/lib/types'
import { SectionNav, PARLAMENTARI_SECTIONS } from '@/components/section-nav'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Parlamentarul tău',
  description: 'Află cine te reprezintă în Parlament: senatorii și deputații județului tău și cum votează.',
}

function MemberTable({ title, members, basePath }: {
  title: string
  members: PoliticianStats[]
  basePath: string
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
        {title} ({members.length})
      </h2>
      {!members.length ? (
        <p className="text-sm text-muted">Nu există date.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b-2 border-sidebar text-[11px] uppercase tracking-[0.14em] text-faint">
                <th className="text-left py-2.5 pr-4 font-medium">Nume</th>
                <th className="text-left py-2.5 pr-4 font-medium">Partid</th>
                <th className="text-right py-2.5 pr-4 font-medium hidden sm:table-cell">Prezență</th>
                <th className="text-right py-2.5 pr-4 font-medium hidden md:table-cell">Devieri</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.politician_id} className="border-b border-rim hover:bg-raised transition-colors">
                  <td className="py-2.5 pr-4">
                    <Link href={`${basePath}/${personSlug(m.first_name, m.name)}`} className="font-medium text-foreground hover:underline">
                      {m.first_name} {m.name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4">
                    <PartyBadge abbreviation={m.party_abbr} color={m.party_color} />
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted hidden sm:table-cell">
                    {m.presence_pct != null ? `${Math.round(m.presence_pct)}%` : '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted hidden md:table-cell">
                    {hasPartyLine(m.party_abbr) ? m.deviations : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default async function ParlamentarulTauPage({
  searchParams,
}: {
  searchParams: Promise<{ judet?: string }>
}) {
  const { judet } = await searchParams
  const db = getDB()

  const [senRes, depRes] = await Promise.all([
    judet
      ? db.from('senator_stats').select('*').eq('active', true).eq('county', judet).order('name')
      : Promise.resolve({ data: [] }),
    judet
      ? db.from('deputy_stats').select('*').eq('active', true).eq('county', judet).order('name')
      : Promise.resolve({ data: [] }),
  ])

  const senators = (senRes.data as PoliticianStats[] | null) ?? []
  const deputies = (depRes.data as PoliticianStats[] | null) ?? []

  return (
    <div className="space-y-8">
      <div>
        <SectionNav items={PARLAMENTARI_SECTIONS} />
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Parlamentarul tău
        </h1>
        <p className="text-sm text-muted mt-3 max-w-2xl">
          Apasă pe județul în care votezi și vezi cine te reprezintă în Senat și în Camera
          Deputaților — și, mai important, cum votează.
        </p>
      </div>

      <div className="max-w-3xl">
        <CountyMap selected={judet} />
        {judet && (
          <p className="text-center text-sm text-muted mt-4">
            Ai ales: <span className="font-semibold text-foreground">{judet}</span>
          </p>
        )}
      </div>

      {/* remounts on every county change → scrolls the results into view */}
      {judet && <ScrollIntoView key={judet} />}

      {judet && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-10">
          {/* minorities seats exist only in the Camera — no empty Senate table */}
          {judet !== 'Minorități' && (
            <MemberTable title={`Senatori — ${judet}`} members={senators} basePath="/senatori" />
          )}
          <MemberTable title={`Deputați — ${judet}`} members={deputies} basePath="/deputati" />
        </div>
      )}

      {judet && !senators.length && !deputies.length && (
        <p className="text-sm text-muted">
          Nu am găsit parlamentari pentru „{judet}" — datele de circumscripție se completează zilnic.
        </p>
      )}
    </div>
  )
}
