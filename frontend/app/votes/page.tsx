import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { MiniVoteBar } from '@/components/mini-vote-bar'
import { VoteFilter } from '@/components/vote-filter'
import type { VoteWithLaw } from '@/lib/types'

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
      let q = db
        .from('votes')
        .select('*, laws!inner(*)', { count: 'exact' })
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
    return `/votes${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Voturi</h1>
        <span className="text-sm text-muted">{count ?? 0} total</span>
      </div>

      <VoteFilter categories={categories} />

      {!votes?.length ? (
        <p className="text-sm text-muted py-8">Nu există voturi pentru filtrele selectate.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rim text-xs uppercase tracking-widest text-muted">
                <th className="text-left py-2 pr-4 font-medium">Cod</th>
                <th className="text-left py-2 pr-4 font-medium">Titlu</th>
                <th className="text-left py-2 pr-4 font-medium hidden lg:table-cell">Categorie</th>
                <th className="text-left py-2 pr-4 font-medium hidden md:table-cell">Dată</th>
                <th className="text-left py-2 pr-4 font-medium">Rezultat</th>
                <th className="hidden xl:table-cell" />
              </tr>
            </thead>
            <tbody>
              {votes.map(vote => (
                <tr key={vote.id} className="border-b border-rim hover:bg-raised transition-colors">
                  <td className={`py-3 pr-4 pl-3 border-l-2 ${
                    vote.outcome === 'adoptat' ? 'border-adoptat' :
                    vote.outcome === 'respins' ? 'border-respins' :
                    'border-rim'
                  }`}>
                    <Link href={`/votes/${vote.id}`} className="font-mono text-foreground hover:underline">
                      {vote.laws?.code ?? '—'}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 max-w-sm">
                    <Link href={`/votes/${vote.id}`} className="line-clamp-2 text-foreground hover:underline">
                      {vote.laws?.title ?? '—'}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell">
                    {vote.laws?.law_category
                      ? <span className="text-xs bg-raised border border-rim text-muted rounded px-2 py-0.5">
                          {vote.laws.law_category}
                        </span>
                      : <span className="text-faint text-xs">—</span>
                    }
                  </td>
                  <td className="py-3 pr-4 text-muted whitespace-nowrap hidden md:table-cell">
                    {formatDate(vote.vote_date)}
                  </td>
                  <td className="py-3 pr-4">
                    <OutcomeBadge outcome={vote.outcome} />
                  </td>
                  <td className="py-3 pl-4 hidden xl:table-cell">
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
