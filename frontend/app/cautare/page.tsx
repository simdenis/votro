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

const LAW_LIMIT = 15   // rows shown
const LAW_SCAN  = 1000 // rows ranked before cutting (PostgREST caps at 1000 anyway)

/** Sortable rank for a law code: "L230/2026" → [2026, 230], "PHCD9/2026" →
 *  [2026, 9]. Newest year first, then highest number — i.e. most recent first.
 *  Codes that don't parse sort last rather than jumping to the top. */
function codeRank(code: string | null): [number, number] {
  const m = /^[A-Za-z-]*\s*(\d+)\s*\/\s*(\d{4})$/.exec((code ?? '').trim())
  return m ? [Number(m[2]), Number(m[1])] : [-1, -1]
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
  // % and _ are ilike wildcards \u2014 a query like "50%" would otherwise match
  // everything starting with "50". Drop them; they carry no search meaning here.
  const nq = q.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[%_]/g, ' ').trim().toLowerCase()

  let politicians: any[] = []
  let laws: any[]        = []
  let parties: any[]     = []
  let lawTotal           = 0

  if (nq.length >= 2) {
    const db = getDB()
    // party term: strip PostgREST-significant chars before interpolating into .or()
    const pq = q.replace(/[,()%*]/g, ' ').trim()
    const [polRes, lawRes, partyRes] = await Promise.all([
      db
        .from('politicians')
        .select('id, name, first_name, chamber, parties(abbreviation, color)')
        .ilike('search_name', `%${nq}%`)
        .order('name')
        .limit(15),
      // Over-fetch and rank in JS. order('code') is a TEXT sort, so it ranked
      // "PHCD20/2026" over "L99/2026" over "L650/2025" — neither relevance nor
      // recency. Combined with a 15-row cut that made the visible results
      // arbitrary for any common word. codeRank sorts by year then number.
      db
        .from('laws')
        .select('id, code, title, law_category', { count: 'exact' })
        .ilike('search_text', `%${nq}%`)
        .limit(LAW_SCAN),
      pq.length >= 2
        ? db
            .from('parties')
            .select('id, abbreviation, name, color')
            .or(`abbreviation.ilike.%${pq}%,name.ilike.%${pq}%`)
            .limit(8)
        : Promise.resolve({ data: [] as any[] }),
    ])
    politicians = polRes.data ?? []
    parties     = partyRes.data ?? []
    lawTotal    = lawRes.count ?? (lawRes.data?.length ?? 0)
    laws        = [...(lawRes.data ?? [])]
      .sort((a: any, b: any) => {
        const [ay, an] = codeRank(a.code), [by, bn] = codeRank(b.code)
        return by - ay || bn - an
      })
      .slice(0, LAW_LIMIT)
  }

  const hasResults = politicians.length > 0 || laws.length > 0 || parties.length > 0
  const searched   = nq.length >= 2

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">Căutare</h1>

      {/* Search form */}
      <form method="GET" action="/cautare">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            aria-label="Caută parlamentar sau lege"
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

      {q.length > 0 && nq.length < 2 && (
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

      {/* Parties */}
      {parties.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Partide ({parties.length})
          </h2>
          <div className="bg-surface border border-rim rounded-xl overflow-hidden divide-y divide-rim">
            {parties.map((p: any) => (
              <Link
                key={p.id}
                href={`/partide/${p.abbreviation}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-raised transition-colors"
              >
                <PartyBadge abbreviation={p.abbreviation} color={p.color} noLink />
                <span className="flex-1 text-sm text-foreground font-medium">{p.name}</span>
                <span className="text-xs text-faint">Partid</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Laws */}
      {laws.length > 0 && (
        <section className="space-y-3">
          {/* the list is capped at LAW_LIMIT rows — say so, or "Legi (15)" reads
              as "there are exactly 15", which for common words is badly wrong */}
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Legi ({lawTotal > laws.length ? `cele mai recente ${laws.length} din ${lawTotal}` : laws.length})
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
