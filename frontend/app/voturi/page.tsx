import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { MiniVoteBar } from '@/components/mini-vote-bar'
import { VoteFilter } from '@/components/vote-filter'
import type { VoteWithLaw } from '@/lib/types'
import { SectionNav, LEGI_SECTIONS } from '@/components/section-nav'
import { CategoryBadge } from '@/components/category-badge'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Voturi', description: 'Toate voturile plenului Senatului și Camerei Deputaților României.' }

const PAGE_SIZE = 25

export default async function VotesPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string; from?: string; to?: string; page?: string; category?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const db = getDB()

  const [votesRes, catRes] = await Promise.all([
    (() => {
      // inner join only when filtering on a law column — a plain join would
      // hide the ~100 plenary votes that have no law attached
      let q = db
        .from('votes')
        .select(sp.category ? '*, laws!inner(*)' : '*, laws(*)', { count: 'exact' })
        .order('vote_date', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      if (sp.outcome)  q = q.eq('outcome', sp.outcome)
      if (sp.from)     q = q.gte('vote_date', sp.from)
      if (sp.to)       q = q.lte('vote_date', sp.to)
      if (sp.category) q = q.eq('laws.law_category', sp.category)
      return q
    })(),
    db.from('laws').select('law_category').not('law_category', 'is', null),
  ])

  const votes      = votesRes.data as VoteWithLaw[] | null
  const count      = votesRes.count
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const categories = [...new Set(
    (catRes.data ?? []).map(r => r.law_category as string).filter(Boolean)
  )].sort()

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (sp.outcome)  params.set('outcome', sp.outcome)
    if (sp.category) params.set('category', sp.category)
    if (sp.from)     params.set('from', sp.from)
    if (sp.to)       params.set('to', sp.to)
    if (p > 1)       params.set('page', String(p))
    const s = params.toString()
    return `/voturi${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <SectionNav items={LEGI_SECTIONS} />
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Voturi</h1>
        <span className="text-[12.5px] text-muted">{count ?? 0} total</span>
      </div>

      <VoteFilter categories={categories} />

      {!votes?.length ? (
        <p className="text-sm text-muted py-8">Nu există voturi pentru filtrele selectate.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b-2 border-sidebar text-[11px] uppercase tracking-[0.14em] text-faint">
                <th className="text-left py-3 pr-4 font-medium">Cod</th>
                <th className="text-left py-3 pr-4 font-medium">Titlu</th>
                <th className="text-left py-3 pr-4 font-medium hidden lg:table-cell">Categorie</th>
                <th className="text-left py-3 pr-4 font-medium hidden md:table-cell">Dată</th>
                <th className="text-left py-3 pr-4 font-medium">Rezultat</th>
                <th className="text-left py-3 pr-4 font-medium hidden sm:table-cell">Voturi</th>
              </tr>
            </thead>
            <tbody>
              {votes.map(vote => (
                <tr key={vote.id} className="border-b border-rim hover:bg-raised transition-colors">
                  <td className="py-3 pr-4">
                    <Link href={`/voturi/${vote.id}`} className="font-mono text-foreground hover:underline" style={{ color: 'var(--sidebar-bg)' }}>
                      {vote.laws?.code ?? 'Plen'}
                    </Link>
                    <span className="block text-[9px] uppercase font-semibold text-faint mt-0.5">
                      {vote.chamber === 'deputies' ? 'Camera' : 'Senat'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 max-w-sm">
                    <Link
                      href={`/voturi/${vote.id}`}
                      className="line-clamp-1 text-foreground hover:underline"
                      title={vote.laws?.title ?? vote.description ?? undefined}
                    >
                      {vote.laws?.title ?? vote.description ?? 'Vot procedural (fără lege identificată)'}
                    </Link>
                    {vote.laws?.law_category && (
                      <div className="lg:hidden mt-1">
                        <CategoryBadge category={vote.laws.law_category} className="text-[10px] px-1.5 py-px rounded" href={`/voturi?category=${encodeURIComponent(vote.laws.law_category)}`} />
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell">
                    {vote.laws?.law_category
                      ? <CategoryBadge category={vote.laws.law_category} href={`/voturi?category=${encodeURIComponent(vote.laws.law_category)}`} />
                      : <span className="text-faint text-xs">—</span>
                    }
                  </td>
                  <td className="py-3 pr-4 text-muted whitespace-nowrap hidden md:table-cell">
                    {formatDate(vote.vote_date)}
                  </td>
                  <td className="py-3 pr-4">
                    <OutcomeBadge outcome={vote.outcome} />
                  </td>
                  <td className="py-3 pr-4 hidden sm:table-cell">
                    <MiniVoteBar
                      forCount={vote.for_count}
                      againstCount={vote.against_count}
                      abstentionCount={vote.abstention_count}
                    />
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
            <Link href={pageUrl(page - 1)} className="text-muted hover:text-foreground">← Anterior</Link>
          )}
          <span className="text-muted">Pagina {page} din {totalPages}</span>
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className="text-muted hover:text-foreground">Următor →</Link>
          )}
        </div>
      )}
    </div>
  )
}
