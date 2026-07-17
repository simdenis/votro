'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { pct, textOnColor, needsDe , personSlug } from '@/lib/utils'
import { PartyBadge } from '@/components/party-badge'
import { trueAbsent, type PoliticianStats } from '@/lib/types'

interface Props {
  title: string
  basePath: string
  people: PoliticianStats[]
  /** ids of members who changed party — shown with a ⇄ badge. */
  switcherIds?: string[]
}

// Numeric columns start descending — "most absent / most deviant first" is
// what a first click means; ascending would show a wall of zeros.
const DESC_FIRST = new Set(['votes', 'absence', 'deviation'])

const collator = new Intl.Collator('ro')

// nulls always sort last, regardless of direction
function numCmp(a: number | null | undefined, b: number | null | undefined, desc: boolean) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return desc ? b - a : a - b
}

function sortPeople(people: PoliticianStats[], sort: string, dir: boolean): PoliticianStats[] {
  const arr = [...people]
  const nameCmp = (a: PoliticianStats, b: PoliticianStats) =>
    collator.compare(a.name ?? '', b.name ?? '') || collator.compare(a.first_name ?? '', b.first_name ?? '')

  if (sort === 'party') {
    arr.sort((a, b) => {
      if (a.party_abbr == null && b.party_abbr == null) return nameCmp(a, b)
      if (a.party_abbr == null) return 1
      if (b.party_abbr == null) return -1
      const c = collator.compare(a.party_abbr, b.party_abbr)
      return (dir ? -c : c) || nameCmp(a, b)
    })
  } else if (sort === 'absence') {
    // Government members (gov_role) never vote — their "absence" is
    // structural, so they sort last. absence = 100 − presence, so
    // descending absence is ascending presence.
    arr.sort((a, b) =>
      (a.gov_role ? 1 : 0) - (b.gov_role ? 1 : 0) ||
      numCmp(a.presence_pct, b.presence_pct, !dir) ||
      nameCmp(a, b)
    )
  } else if (sort === 'votes') {
    arr.sort((a, b) => numCmp(a.total_votes, b.total_votes, dir) || nameCmp(a, b))
  } else if (sort === 'deviation') {
    arr.sort((a, b) => numCmp(a.deviation_pct, b.deviation_pct, dir) || nameCmp(a, b))
  } else {
    arr.sort((a, b) => {
      const c = nameCmp(a, b)
      return dir ? -c : c
    })
  }
  return arr
}

export function PoliticianList({ title, basePath, people, switcherIds }: Props) {
  const [sort, setSort] = useState('name')
  const [dir, setDir] = useState(false)

  // pick up ?sort=…&dir=… from a shared link (page itself is static)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('sort')
    if (s) {
      setSort(s)
      setDir(params.get('dir') === 'desc')
    }
  }, [])

  const sorted = useMemo(() => sortPeople(people, sort, dir), [people, sort, dir])
  const switchers = useMemo(() => new Set(switcherIds ?? []), [switcherIds])

  function clickSort(col: string) {
    const newDir =
      sort === col ? !dir
      : DESC_FIRST.has(col)
    setSort(col)
    setDir(newDir)
    // keep the URL shareable without re-rendering the page on the server
    const params = new URLSearchParams()
    params.set('sort', col)
    if (newDir) params.set('dir', 'desc')
    window.history.replaceState(null, '', `${basePath}?${params.toString()}`)
  }

  function sortIcon(col: string) {
    if (sort !== col) return <span className="text-faint">↕</span>
    return dir ? '↓' : '↑'
  }

  const th = (col: string, label: string) => (
    <button type="button" onClick={() => clickSort(col)} className="hover:text-foreground uppercase tracking-[0.14em] font-medium cursor-pointer">
      {label} {sortIcon(col)}
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">{title}</h1>
        <span className="text-[12.5px] text-muted">{people.length}{needsDe(people.length) ? ' de' : ''} {title.toLowerCase()}</span>
      </div>

      {!people.length ? (
        <p className="text-[15px] text-muted">Nu există date.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b-2 border-sidebar text-[11px] text-faint">
                <th className="text-left py-3 pr-4 font-medium">{th('name', 'Nume')}</th>
                <th className="text-left py-3 pr-4 font-medium">{th('party', 'Partid')}</th>
                <th className="text-left py-3 pr-4 font-medium hidden lg:table-cell">{th('votes', 'Comportament vot')}</th>
                <th className="text-right py-3 pr-4 font-medium w-[90px]">{th('absence', 'Absență')}</th>
                <th className="text-right py-3 font-medium w-[160px]">{th('deviation', 'Devieri de la partid')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => {
                const dev  = s.deviation_pct ?? 0
                const high = dev > 10
                // Independents / national-minority deputies have no party line to deviate from.
                const noLine = s.party_abbr === 'IND' || s.party_abbr === 'MIN'
                const initials = `${s.first_name?.[0] ?? ''}${s.name?.[0] ?? ''}`
                const absence = s.presence_pct == null ? null : Math.round(100 - s.presence_pct)
                // Grey segment = true absences (chamber votes − participations),
                // not the undercounted recorded 'absent' rows.
                const absent = trueAbsent(s) ?? s.votes_absent ?? 0
                const beh = [
                  { v: s.votes_for ?? 0,        c: 'var(--color-for)' },
                  { v: s.votes_against ?? 0,    c: 'var(--color-against)' },
                  { v: s.votes_abstention ?? 0, c: 'var(--color-abstention)' },
                  { v: absent,                  c: 'var(--rim)' },
                ]
                const behTitle = `${s.votes_for ?? 0} pentru · ${s.votes_against ?? 0} împotrivă · ${s.votes_abstention ?? 0} abțineri · ${absent} absent`
                return (
                  <tr key={s.politician_id} className="border-b border-rim hover:bg-raised transition-colors">
                    <td className="py-3 pr-4">
                      <Link href={`${basePath}/${personSlug(s.first_name, s.name)}`} className="flex items-center gap-3 group">
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 select-none"
                          style={{ backgroundColor: s.party_color ?? '#9e9e9e', color: textOnColor(s.party_color ?? '#9e9e9e') }}
                        >
                          {initials}
                        </span>
                        <span className="font-medium text-foreground group-hover:underline">
                          {s.first_name} {s.name}
                        </span>
                        {s.gov_role && (
                          <span
                            className="text-[10px] uppercase font-semibold tracking-wide bg-sidebar text-white rounded-[3px] px-1.5 py-px flex-shrink-0"
                            title="În Guvern în această legislatură (actual sau fost) — în funcție nu votează în plen"
                          >
                            guvern · {s.gov_role}
                          </span>
                        )}
                        {switchers.has(s.politician_id) && (
                          <span
                            className="text-[10px] font-semibold text-deviere bg-deviere/10 rounded-[3px] px-1.5 py-px flex-shrink-0"
                            title="A schimbat partidul în acest mandat"
                          >
                            ⇄ a schimbat partidul
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <PartyBadge abbreviation={s.party_abbr} color={s.party_color} />
                    </td>
                    <td className="py-3 pr-4 hidden lg:table-cell">
                      <div className="flex h-[7px] w-[170px] rounded-full overflow-hidden bg-raised" title={behTitle}>
                        {beh.map((b, i) => b.v > 0 && <div key={i} style={{ flex: b.v, backgroundColor: b.c }} />)}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {s.gov_role ? (
                        <span className="text-[13px] text-faint" title="În Guvern în această legislatură — în funcție nu votează în plen, deci absența e structurală">—</span>
                      ) : (
                        <span className={`tabular-nums text-[13px] ${absence !== null && absence > 30 ? 'text-respins font-semibold' : 'text-muted'}`}>
                          {absence === null ? '—' : `${absence}%`}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {noLine ? (
                        <div className="text-right text-[13px] text-faint pr-1" title="Fără linie de partid">—</div>
                      ) : (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="h-[6px] w-[70px] rounded-full bg-raised overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(dev, 100)}%`, backgroundColor: high ? 'var(--color-deviation)' : 'var(--muted)' }}
                            />
                          </div>
                          <span className={`tabular-nums text-[13px] w-12 text-right ${high ? 'text-deviere font-semibold' : 'text-muted'}`}>
                            {pct(s.deviation_pct)}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
