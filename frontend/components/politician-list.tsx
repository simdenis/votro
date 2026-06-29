import Link from 'next/link'
import { pct } from '@/lib/utils'
import { PartyBadge } from '@/components/party-badge'
import type { PoliticianStats } from '@/lib/types'

interface Props {
  title: string
  basePath: string
  people: PoliticianStats[]
  sort: string
  dir: boolean
}

export function PoliticianList({ title, basePath, people, sort, dir }: Props) {
  function sortUrl(col: string) {
    const newDir = sort === col && !dir ? 'desc' : ''
    const params = new URLSearchParams()
    params.set('sort', col)
    if (newDir) params.set('dir', newDir)
    return `${basePath}?${params.toString()}`
  }

  function sortIcon(col: string) {
    if (sort !== col) return <span className="text-faint">↕</span>
    return dir ? '↓' : '↑'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <span className="text-sm text-muted">{people.length} {title.toLowerCase()}</span>
      </div>

      {!people.length ? (
        <p className="text-sm text-muted">Nu există date.</p>
      ) : (
        <div className="border border-rim rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-raised text-[11px] uppercase tracking-widest text-foreground/70 border-b border-rim">
                <th className="text-left py-2.5 pr-4 pl-3 font-bold">
                  <Link href={sortUrl('name')} className="hover:text-foreground">
                    Nume {sortIcon('name')}
                  </Link>
                </th>
                <th className="text-left py-2.5 pr-4 font-bold">Partid</th>
                <th className="text-right py-2.5 pr-4 font-bold hidden md:table-cell">
                  <Link href={sortUrl('votes')} className="hover:text-foreground">
                    Voturi {sortIcon('votes')}
                  </Link>
                </th>
                <th className="text-right py-2.5 pr-4 font-bold hidden lg:table-cell">
                  <Link href={sortUrl('presence')} className="hover:text-foreground">
                    Prezență {sortIcon('presence')}
                  </Link>
                </th>
                <th className="text-right py-2.5 pr-4 font-bold">
                  <Link href={sortUrl('deviation')} className="hover:text-foreground">
                    Devieri {sortIcon('deviation')}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map(s => (
                <tr key={s.politician_id} className="border-b border-rim/60 last:border-0 hover:bg-raised transition-colors">
                  <td className="py-3 pr-4 pl-3">
                    <Link href={`${basePath}/${s.politician_id}`} className="text-foreground hover:underline">
                      {s.first_name} {s.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <PartyBadge abbreviation={s.party_abbr} color={s.party_color} />
                  </td>
                  <td className="py-3 pr-4 text-right text-muted tabular-nums hidden md:table-cell">
                    {s.total_votes}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums hidden lg:table-cell">
                    <span className={
                      s.presence_pct != null && s.presence_pct < 60 ? 'text-respins font-semibold' :
                      s.presence_pct != null && s.presence_pct < 80 ? 'text-deviere' :
                      'text-muted'
                    }>
                      {pct(s.presence_pct)}
                    </span>
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    <span className={s.deviation_pct != null && s.deviation_pct > 10 ? 'text-deviere font-semibold' : 'text-muted'}>
                      {s.deviation_pct != null && s.deviation_pct > 10 && '⚠ '}
                      {pct(s.deviation_pct)}
                    </span>
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
