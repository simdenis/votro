import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, capFirst, lawSlug } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { BaseLawBadges } from '@/components/base-law-badge'
import { CategoryBadge } from '@/components/category-badge'
import type { LawStatus, PresidentialStatus } from '@/lib/types'
import { SectionNav, LEGI_SECTIONS } from '@/components/section-nav'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Legi',
  description: 'Stadiul fiecărei legi prin Senat și Camera Deputaților.',
}

const PAGE_SIZE = 25

type Tab = 'toate' | 'senat' | 'camera' | 'purgatoriu' | 'promulgate' | 'respinse'

const TABS: { id: Tab; label: string }[] = [
  { id: 'toate',      label: 'Toate' },
  { id: 'senat',      label: 'Senat' },
  { id: 'camera',     label: 'Camera' },
  { id: 'purgatoriu', label: 'Purgatoriu' },
  { id: 'promulgate', label: 'Promulgate' },
  { id: 'respinse',   label: 'Respinse' },
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
  return `text-[13.5px] px-3.5 py-1.5 rounded-full border font-medium transition-colors ${
    active
      ? 'border-[var(--ink)] text-white bg-[var(--ink)]'
      : 'border-rim text-foreground/75 hover:text-foreground hover:border-foreground/40 hover:bg-raised'
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

/** Sub-md the three outcome columns collapse into this compact line under the
    title — the full table forced sideways swiping on phones. */
function stageChip(label: string, outcome: 'adoptat' | 'respins' | null, voteId: string | null, passed: boolean) {
  const mark = voteId
    ? (outcome === 'respins'
        ? <span className="text-respins font-bold">✗</span>
        : <span className="text-adoptat font-bold">✓</span>)
    : passed
      ? <span className="text-adoptat/80">✓*</span>
      : <span className="text-faint">—</span>
  return <span className="whitespace-nowrap text-muted">{label} {mark}</span>
}

function presidentCell(status: PresidentialStatus | null, date: string | null) {
  if (!status) {
    return <span className="text-xs text-faint">—</span>
  }
  const label =
    status === 'promulgat' ? 'Promulgată'
    : status === 'retrimis' ? 'Retrimisă la Parlament'
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
  if (tab === 'promulgate') q = q.eq('presidential_status', 'promulgat')
  if (tab === 'respinse')   q = q.or('senate_outcome.eq.respins,camera_outcome.eq.respins')
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
      <SectionNav items={LEGI_SECTIONS} />
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Legi</h1>
        <span className="text-[12.5px] text-muted">{count ?? 0} total</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-rim overflow-x-auto">
        {TABS.map(t => (
          <Link
            key={t.id}
            href={buildUrl({ tab: t.id })}
            className={`px-4 py-2.5 text-[15px] font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
              tab === t.id
                ? 'border-sidebar text-foreground'
                : 'border-transparent text-foreground/55 hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Sort + category controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] uppercase tracking-[0.12em] font-semibold text-faint mr-1">Sortează</span>
          {SORTS.map(s => (
            <Link key={s.id} href={buildUrl({ sort: s.id })} className={chipClass(sort === s.id)}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] uppercase tracking-[0.12em] font-semibold text-faint mr-1">Categorie</span>
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

      {laws.some(l => !!l.presidential_status && (!l.senate_vote_id || !l.camera_vote_id)) && (
        <p className="text-xs text-faint">
          <span className="text-adoptat/80">Adoptată*</span> — legea a trecut prin ambele camere (e promulgată/la președinte),
          dar nu avem votul în plen al unei camere: adoptare tacită, sau votul nu e încă în baza de date.
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
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b-2 border-sidebar text-[11px] uppercase tracking-[0.14em] text-faint">
                <th className="text-left py-2.5 pr-4 font-medium">Cod</th>
                <th className="text-left py-2.5 pr-4 font-medium">Titlu</th>
                <th className="text-left py-2.5 pr-4 font-medium hidden lg:table-cell">Categorie</th>
                <th className="text-left py-2.5 pr-4 font-medium hidden md:table-cell">Senat</th>
                <th className="text-left py-2.5 pr-4 font-medium hidden md:table-cell">Camera</th>
                <th className="text-left py-2.5 font-medium hidden md:table-cell">Președinte</th>
              </tr>
            </thead>
            <tbody>
              {laws.map(law => (
                <tr key={law.law_id} className="border-b border-rim hover:bg-raised transition-colors">
                  <td className="py-3 pr-4">
                    <Link href={`/legi/${lawSlug(law.code)}`} className="font-mono hover:underline whitespace-nowrap" style={{ color: 'var(--sidebar-bg)' }}>
                      {law.code}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 max-w-xs">
                    {/* plain-language summary is the headline where we have one;
                        the official title stays as the small verifiable subtitle */}
                    <Link href={`/legi/${lawSlug(law.code)}`} className="block hover:underline" title={capFirst(law.title)}>
                      <span className="line-clamp-2 text-foreground">{law.summary || capFirst(law.title)}</span>
                      {law.summary && (
                        <span className="line-clamp-1 text-[11px] text-faint mt-0.5">{capFirst(law.title)}</span>
                      )}
                    </Link>
                    <div className="flex gap-1 mt-1 flex-wrap items-center">
                      {law.law_category && law.summary_is_ai && (
                        <span className="lg:hidden inline-flex">
                          <CategoryBadge category={law.law_category} className="text-[10px] px-1.5 py-px rounded" />
                        </span>
                      )}
                      <BaseLawBadges title={law.title} />
                    </div>
                    <div className="md:hidden mt-1.5 flex items-center gap-3 text-[11px]">
                      {stageChip('Senat', law.senate_outcome, law.senate_vote_id, !!law.presidential_status)}
                      {stageChip('Cameră', law.camera_outcome, law.camera_vote_id, !!law.presidential_status)}
                      {law.presidential_status && (
                        <span className={`whitespace-nowrap font-medium ${
                          law.presidential_status === 'promulgat' ? 'text-adoptat'
                          : law.presidential_status === 'retrimis' ? 'text-respins'
                          : 'text-amber-500'
                        }`}>
                          {law.presidential_status === 'promulgat' ? 'Promulgată'
                            : law.presidential_status === 'retrimis' ? 'Retrimisă'
                            : 'CCR'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell">
                    {law.law_category && law.summary_is_ai
                      ? <CategoryBadge category={law.law_category} />
                      : <span className="text-faint text-xs">—</span>}
                  </td>
                  <td className="py-3 pr-4 hidden md:table-cell">
                    {outcomeCell(law.senate_outcome, law.senate_vote_id, law.senate_vote_date, !!law.presidential_status)}
                  </td>
                  <td className="py-3 pr-4 hidden md:table-cell">
                    {outcomeCell(law.camera_outcome, law.camera_vote_id, law.camera_vote_date, !!law.presidential_status)}
                  </td>
                  <td className="py-3 hidden md:table-cell">
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
