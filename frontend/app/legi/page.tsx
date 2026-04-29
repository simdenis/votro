import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import type { LawStatus } from '@/lib/types'

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

function outcomeCell(outcome: 'adoptat' | 'respins' | null, voteId: string | null, date: string | null) {
  if (!voteId) {
    return <span className="text-xs text-faint">—</span>
  }
  return (
    <div className="flex flex-col gap-0.5">
      <OutcomeBadge outcome={outcome} />
      {date && <span className="text-[10px] text-faint">{formatDate(date)}</span>}
    </div>
  )
}

export default async function LegiPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const sp   = await searchParams
  const tab  = (sp.tab ?? 'toate') as Tab
  const page = Math.max(1, Number(sp.page) || 1)
  const db   = getDB()

  let q = db
    .from('law_status')
    .select('*', { count: 'exact' })
    .order('senate_vote_date', { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (tab === 'senat')      q = q.not('senate_vote_id', 'is', null)
  if (tab === 'camera')     q = q.not('camera_vote_id', 'is', null)
  if (tab === 'purgatoriu') q = q.in('status', ['asteapta_camera', 'asteapta_senat'])

  const { data, count } = await q
  const laws       = (data as LawStatus[] | null) ?? []
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function tabUrl(t: Tab) {
    const p = new URLSearchParams()
    if (t !== 'toate') p.set('tab', t)
    return `/legi${p.size ? `?${p}` : ''}`
  }

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (tab !== 'toate') params.set('tab', tab)
    if (p > 1) params.set('page', String(p))
    return `/legi${params.size ? `?${params}` : ''}`
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
            href={tabUrl(t.id)}
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
                <th className="text-left py-2 font-medium">Camera</th>
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
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell">
                    {law.law_category
                      ? <span className="text-xs bg-raised border border-rim text-muted rounded px-2 py-0.5">{law.law_category}</span>
                      : <span className="text-faint text-xs">—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {outcomeCell(law.senate_outcome, law.senate_vote_id, law.senate_vote_date)}
                  </td>
                  <td className="py-3">
                    {outcomeCell(law.camera_outcome, law.camera_vote_id, law.camera_vote_date)}
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
