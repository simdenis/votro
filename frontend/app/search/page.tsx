import { capFirst, lawSlug , personSlug } from '@/lib/utils'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { PartyBadge } from '@/components/party-badge'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Căutare',
  description: 'Caută parlamentari și legi în LaButoane.',
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const sp = await searchParams
  const q  = sp.q?.trim() ?? ''
  // Diacritic-insensitive: strip accents + lowercase, matching the DB's
  // generated search columns (migration 016).
  const nq = q.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  let politicians: any[] = []
  let laws: any[]        = []

  if (q.length >= 2) {
    const db = getDB()
    const [polRes, lawRes] = await Promise.all([
      db
        .from('politicians')
        .select('id, name, first_name, chamber, parties(abbreviation, color)')
        .ilike('search_name', `%${nq}%`)
        .order('name')
        .limit(15),
      db
        .from('laws')
        .select('id, code, title, law_category')
        .ilike('search_text', `%${nq}%`)
        .order('code', { ascending: false })
        .limit(15),
    ])
    politicians = polRes.data ?? []
    laws        = lawRes.data  ?? []
  }

  const hasResults = politicians.length > 0 || laws.length > 0
  const searched   = q.length >= 2

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Căutare</h1>

      {/* Search form */}
      <form method="GET" action="/search">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Caută parlamentar sau lege…"
            autoFocus
            className="flex-1 bg-surface border border-rim rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-faint focus:outline-none focus:border-foreground/40 transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-foreground text-page text-sm font-medium rounded-lg hover:opacity-80 transition-opacity"
          >
            Caută
          </button>
        </div>
      </form>

      {q.length > 0 && q.length < 2 && (
        <p className="text-sm text-muted">Introdu cel puțin 2 caractere.</p>
      )}

      {searched && !hasResults && (
        <p className="text-sm text-muted">
          Niciun rezultat pentru <strong className="text-foreground">"{q}"</strong>.
        </p>
      )}

      {/* Politicians */}
      {politicians.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Parlamentari ({politicians.length})
          </h2>
          <div className="bg-surface border border-rim rounded-xl overflow-hidden divide-y divide-rim">
            {politicians.map((p: any) => {
              const href = p.chamber === 'senate'
                ? `/senatori/${personSlug(p.first_name, p.name)}`
                : `/deputati/${personSlug(p.first_name, p.name)}`
              return (
                <Link
                  key={p.id}
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-raised transition-colors"
                >
                  <span className="flex-1 text-sm text-foreground font-medium">
                    {p.first_name} {p.name}
                  </span>
                  <span className="text-xs text-faint">
                    {p.chamber === 'senate' ? 'Senator' : 'Deputat'}
                  </span>
                  {p.parties && (
                    <PartyBadge
                      abbreviation={p.parties.abbreviation}
                      color={p.parties.color}
                      noLink
                    />
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Laws */}
      {laws.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Legi ({laws.length})
          </h2>
          <div className="bg-surface border border-rim rounded-xl overflow-hidden divide-y divide-rim">
            {laws.map((l: any) => (
              <Link
                key={l.id}
                href={`/legi/${lawSlug(l.code)}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-raised transition-colors"
              >
                <span className="font-mono text-xs text-muted font-semibold mt-0.5 shrink-0">
                  {l.code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">{capFirst(l.title)}</p>
                  {l.law_category && (
                    <span className="text-[10px] text-faint bg-raised border border-rim rounded px-1.5 py-px mt-1 inline-block">
                      {l.law_category}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
