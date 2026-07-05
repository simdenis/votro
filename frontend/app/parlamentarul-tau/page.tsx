import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { PartyBadge } from '@/components/party-badge'
import { hasPartyLine } from '@/lib/utils'
import type { PoliticianStats } from '@/lib/types'

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
                    <Link href={`${basePath}/${m.politician_id}`} className="font-medium text-foreground hover:underline">
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

  const [senRes, depRes, countiesRes] = await Promise.all([
    judet
      ? db.from('senator_stats').select('*').eq('active', true).eq('county', judet).order('name')
      : Promise.resolve({ data: [] }),
    judet
      ? db.from('deputy_stats').select('*').eq('active', true).eq('county', judet).order('name')
      : Promise.resolve({ data: [] }),
    db.from('politicians').select('county').eq('active', true).not('county', 'is', null),
  ])

  const counties = [...new Set((countiesRes.data ?? []).map(r => r.county as string))]
    .sort((a, b) => a.localeCompare(b, 'ro'))
  const senators = (senRes.data as PoliticianStats[] | null) ?? []
  const deputies = (depRes.data as PoliticianStats[] | null) ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Parlamentarul tău
        </h1>
        <p className="text-sm text-muted mt-3 max-w-2xl">
          Alege județul în care votezi și vezi cine te reprezintă în Senat și în Camera
          Deputaților — și, mai important, cum votează.
        </p>
      </div>

      {/* Plain GET form — works without JS */}
      <form action="/parlamentarul-tau" method="get" className="flex items-center gap-3 flex-wrap">
        <select
          name="judet"
          defaultValue={judet ?? ''}
          className="border border-rim rounded-md text-sm px-3 py-2 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-[#5050c0]"
        >
          <option value="">Alege județul…</option>
          {counties.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="submit"
          className="text-sm font-medium text-white rounded-md px-4 py-2"
          style={{ backgroundColor: 'var(--sidebar-bg)' }}
        >
          Arată
        </button>
      </form>

      {judet && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-10">
          <MemberTable title={`Senatori — ${judet}`} members={senators} basePath="/senators" />
          <MemberTable title={`Deputați — ${judet}`} members={deputies} basePath="/deputies" />
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
