import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { BaseLawBadges } from '@/components/base-law-badge'
import type { LawStatus, PresidentialStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Legi',
  description: 'Stadiul fiecărei legi prin Senat și Camera Deputaților.',
}

const PAGE_SIZE = 25

type Tab = 'toate' | 'senat' | 'camera' | 'purgatoriu'

const TABS: { id: Tab; label: string }[] = [
  { id: 'toate',      label: 'Toate' },
  { id: 'senat',      label: 'Senat' },
  { id: 'camera',     label: 'Camera' },
  { id: 'purgatoriu', label: 'Purgatoriu' },
]

type Sort = 'presedinte' | 'senat' | 'camera'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'presedinte', label: 'Președinte' },
  { id: 'senat',      label: 'Senat' },
  { id: 'camera',     label: 'Camera' },
]

// Mirrors the scraper's law-category classifier (camera_scraper._CATEGORY_RULES).
const CATEGORIES = [
  'Sănătate', 'Educație', 'Justiție', 'Social', 'Infrastructură', 'Transport',
  'Agricultură', 'Mediu', 'Energie', 'Apărare', 'Economie', 'Tehnologie',
  'Administrație',
] as const

function chipClass(active: boolean) {
  return `text-xs px-2.5 py-1 rounded-full border transition-colors ${
    active
      ? 'border-respins text-foreground bg-raised'
      : 'border-rim text-muted hover:text-foreground hover:border-foreground/40'
  }`
}

function outcomeCell(outcome: 'adoptat' | 'respins' | null, voteId: string | null, date: string | null, passed = false) {
  if (!voteId) {
    // A promulgated/forwarded law passed both chambers even if we have no plenary
    // vote for one of them (tacit adoption, or vote not yet scraped).
    if (passed) {
      return <span className="text-xs text-adoptat/80" title="Adoptată fără vot în plen (tacit) sau vot neînregistrat">Adoptată*</span>
    }
    return <span className="text-xs text-faint">—</span>
  }
  return (
    <div className="flex flex-col gap-0.5">
      <OutcomeBadge outcome={outcome} />
      {date && <span className="text-[10px] text-faint">{formatDate(date)}</span>}
    </div>
  )
}

function presidentCell(status: PresidentialStatus | null, date: string | null) {
  if (!status) {
    return <span className="text-xs text-faint">—</span>
  }
  const label =
    status === 'promulgat' ? 'Promulgată'
    : status === 'retrimis' ? 'Retrimisă'
    : 'Sesizată CCR'
  const color =
    status === 'promulgat' ? 'text-adoptat'
    : status === 'retrimis' ? 'text-respins'
    : 'text-amber-500'
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-xs font-medium ${color}`}>{label}</span>
      {date && <span className="text-[10px] text-faint">{formatDate(date)}</span>}
    </div>
  )
}

export default async function LegiPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; sort?: string; category?: string }>
}) {
  const sp   = await searchParams
  const tab  = (sp.tab ?? 'toate') as Tab
  const sort = (SORTS.some(s => s.id === sp.sort) ? sp.sort : 'presedinte') as Sort
  const category = CATEGORIES.includes(sp.category as typeof CATEGORIES[number])
    ? (sp.category as string)
    : null
  const page = Math.max(1, Number(sp.page) || 1)
  const db   = getDB()

  let q = db
    .from('law_status')
    .select('*', { count: 'exact' })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  // Sort
  if (sort === 'senat') {
    q = q.order('senate_vote_date', { ascending: false, nullsFirst: false })
  } else if (sort === 'camera') {
    q = q.order('camera_vote_date', { ascending: false, nullsFirst: false })
  } else {
    // 'presedinte': most recently promulgated first, Senate vote as fallback.
    q = q
      .order('presidential_date', { ascending: false, nullsFirst: false })
      .order('senate_vote_date', { ascending: false, nullsFirst: false })
  }

  // Filters
  if (tab === 'senat')      q = q.not('senate_vote_id', 'is', null)
  if (tab === 'camera')     q = q.not('camera_vote_id', 'is', null)
  if (tab === 'purgatoriu') q = q.in('status', ['asteapta_camera', 'asteapta_senat'])
  if (category)             q = q.eq('law_category', category)

  const { data, count } = await q
  const laws       = (data as LawStatus[] | null) ?? []
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  // Build a /legi URL from the current state with selective overrides.
  // Any change other than `page` resets pagination to 1.
  function buildUrl(over: { tab?: Tab; sort?: Sort; category?: string | null; page?: number }) {
    const t = over.tab ?? tab
    const s = over.sort ?? sort
    const c = over.category !== undefined ? over.category : category
    const pg = over.page ?? 1
    const p = new URLSearchParams()
    if (t !== 'toate')      p.set('tab', t)
    if (s !== 'presedinte') p.set('sort', s)
    if (c)                  p.set('category', c)
    if (pg > 1)             p.set('page', String(pg))
    return `/legi${p.size ? `?${p}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Legi</h1>
        <span className="text-sm text-muted">{count ?? 0} total</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-rim">
        {TABS.map(t => (
          <Link
            key={t.id}
            href={buildUrl({ tab: t.id })}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-respins text-foreground'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Sort + category controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest text-muted mr-1">Sortează</span>
          {SORTS.map(s => (
            <Link key={s.id} href={buildUrl({ sort: s.id })} className={chipClass(sort === s.id)}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest text-muted mr-1">Categorie</span>
          <Link href={buildUrl({ category: null })} className={chipClass(category === null)}>
            Toate
          </Link>
          {CATEGORIES.map(c => (
            <Link key={c} href={buildUrl({ category: c })} className={chipClass(category === c)}>
              {c}
            </Link>
          ))}
        </div>
      </div>

      {tab === 'purgatoriu' && (
        <p className="text-sm text-muted">
          Legi care au trecut printr-o cameră dar încă așteaptă votul celeilalte.
        </p>
      )}

      {!laws.length ? (
        <p className="text-sm text-muted py-8">
          {tab === 'camera'
            ? 'Datele Camerei Deputaților nu au fost încă importate.'
            : 'Nu există legi pentru filtrul selectat.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rim text-xs uppercase tracking-widest text-muted">
                <th className="text-left py-2 pr-4 font-medium">Cod</th>
                <th className="text-left py-2 pr-4 font-medium">Titlu</th>
                <th className="text-left py-2 pr-4 font-medium hidden lg:table-cell">Categorie</th>
                <th className="text-left py-2 pr-4 font-medium">Senat</th>
                <th className="text-left py-2 pr-4 font-medium">Camera</th>
                <th className="text-left py-2 font-medium">Președinte</th>
              </tr>
            </thead>
            <tbody>
              {laws.map(law => (
                <tr key={law.law_id} className="border-b border-rim hover:bg-raised transition-colors">
                  <td className="py-3 pr-4 pl-3">
                    <Link href={`/legi/${law.law_id}`} className="font-mono text-foreground hover:underline whitespace-nowrap">
                      {law.code}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 max-w-xs">
                    <Link href={`/legi/${law.law_id}`} className="line-clamp-2 text-foreground hover:underline">
                      {law.title}
                    </Link>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <BaseLawBadges title={law.title} />
                    </div>
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell">
                    {law.law_category
                      ? <span className="text-xs bg-raised border border-rim text-muted rounded px-2 py-0.5">{law.law_category}</span>
                      : <span className="text-faint text-xs">—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {outcomeCell(law.senate_outcome, law.senate_vote_id, law.senate_vote_date, !!law.presidential_status)}
                  </td>
                  <td className="py-3 pr-4">
                    {outcomeCell(law.camera_outcome, law.camera_vote_id, law.camera_vote_date, !!law.presidential_status)}
                  </td>
                  <td className="py-3">
                    {presidentCell(law.presidential_status, law.presidential_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-4 text-sm">
          {page > 1 && (
            <Link href={buildUrl({ page: page - 1 })} className="text-muted hover:text-foreground">← Anterior</Link>
          )}
          <span className="text-muted">Pagina {page} din {totalPages}</span>
          {page < totalPages && (
            <Link href={buildUrl({ page: page + 1 })} className="text-muted hover:text-foreground">Următor →</Link>
          )}
        </div>
      )}
    </div>
  )
}
