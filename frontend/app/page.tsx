import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, countNoun, hasPartyLine, capFirst, recessUntil, CONTESTED_MIN_PCT } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { ParliamentBar } from '@/components/parliament-bar'
import { CountyMap } from '@/components/county-map'
import type { VoteWithLaw, PartyCohesion } from '@/lib/types'
import { CategoryBadge } from '@/components/category-badge'
import { NewsletterForm } from '@/components/newsletter-form'

export const dynamic = 'force-dynamic'
// absolute: the "%s | LaButoane" template would burn the homepage SERP line on "Acasă"
export const metadata: Metadata = { title: { absolute: 'LaButoane — Cum votează Parlamentul României' } }

export default async function Dashboard() {
  const db = getDB()

  const [r0, r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
    db.from('law_status').select('*', { count: 'exact', head: true }),
    // cohesion is computed on contested votes only (migration 027) — require
    // enough of them for the percentage to mean something
    db.from('party_cohesion').select('*').gte('votes_participated', 10).order('cohesion_pct', { ascending: false }),
    // substantive votes only — presence checks / agenda changes drown the feed
    db.from('votes').select('*, laws(*)').not('law_id', 'is', null).order('vote_date', { ascending: false }).limit(8),
    db.from('law_status').select('*', { count: 'exact', head: true }).eq('presidential_status', 'promulgat'),
    db.from('law_status').select('*', { count: 'exact', head: true }).or('senate_outcome.eq.respins,camera_outcome.eq.respins'),
    db.from('parties').select('abbreviation, color, name'),
    db.from('politicians').select('party_id, parties(abbreviation)', { count: 'exact', head: false }).eq('active', true),
    // Absențe top 5 — lowest presence since mandate start, both chambers.
    // Government members (gov_role) never vote in plen — structural absence.
    db.from('senator_stats').select('politician_id, name, first_name, party_abbr, party_color, presence_pct')
      .eq('active', true).is('gov_role', null)
      .order('presence_pct', { ascending: true }).limit(5),
    db.from('deputy_stats').select('politician_id, name, first_name, party_abbr, party_color, presence_pct')
      .eq('active', true).is('gov_role', null)
      .order('presence_pct', { ascending: true }).limit(5),
  ])

  const totalLaws     = r0.count ?? 0
  // IND/MIN are catch-all labels, not parties — "cohesion" is meaningless there
  const cohesionData  = ((r1.data as PartyCohesion[] | null) ?? []).filter(c => hasPartyLine(c.abbreviation))
  const recentVotes   = (r2.data as VoteWithLaw[] | null) ?? []
  const promulgatedCount = r3.count ?? 0
  const respinsCount  = r4.count ?? 0
  const allParties    = r5.data ?? []
  type LowPresence = { politician_id: string; name: string; first_name: string; party_abbr: string; party_color: string; presence_pct: number; href: string }
  const lowPresence: LowPresence[] = [
    ...((r7.data ?? []) as Omit<LowPresence, 'href'>[]).map(s => ({ ...s, href: `/senatori/${s.politician_id}` })),
    ...((r8.data ?? []) as Omit<LowPresence, 'href'>[]).map(s => ({ ...s, href: `/deputati/${s.politician_id}` })),
  ].sort((a, b) => a.presence_pct - b.presence_pct).slice(0, 5)

  const senatorCounts: Record<string, number> = {}
  for (const p of (r6.data ?? []) as any[]) {
    const abbr = p.parties?.abbreviation
    if (abbr) senatorCounts[abbr] = (senatorCounts[abbr] ?? 0) + 1
  }
  const parliamentParties = allParties
    .map(p => ({ ...p, senator_count: senatorCounts[p.abbreviation] ?? 0 }))
    .filter(p => p.senator_count > 0)
    .sort((a, b) => b.senator_count - a.senator_count)
  const totalSenators = parliamentParties.reduce((s, p) => s + p.senator_count, 0)

  const stats = [
    { value: totalLaws,        label: 'legi urmărite', color: 'var(--text)',          href: '/legi' },
    { value: promulgatedCount, label: 'promulgate',    color: 'var(--color-for)',     href: '/legi?tab=promulgate' },
    { value: respinsCount,     label: 'respinse',      color: 'var(--color-against)', href: '/legi?tab=respinse' },
  ]

  return (
    <div>

      {/* ── Header ───────────────────────────────────────── */}
      <header className="mb-9 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-faint mb-2.5">
            Parlamentul României · Legislatura 2024–2028
          </p>
          <h1 className="font-serif text-[42px] font-normal tracking-[-0.01em] leading-[1.04] text-foreground">
            Cum votează Parlamentul?
          </h1>
          {/* plain GET form — works before hydration and for crawlers */}
          <form action="/search" className="mt-4 max-w-[420px]">
            <input
              name="q"
              type="search"
              placeholder="Caută un parlamentar sau o lege…"
              aria-label="Caută un parlamentar sau o lege"
              className="w-full border border-rim rounded-lg px-3.5 py-2 text-[14px] bg-surface placeholder:text-faint focus:outline-none focus:border-foreground/40"
            />
          </form>
        </div>
      </header>

      {/* ── Stats row ────────────────────────────────────── */}
      <section className="grid grid-cols-3 border-t-2 border-sidebar mb-12">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            href={s.href}
            className={`py-5 pr-6 hover:bg-raised/60 transition-colors ${i > 0 ? 'border-l border-rim pl-4 sm:pl-6' : ''}`}
          >
            <div className="text-[36px] font-bold tabular-nums tracking-[-0.02em] leading-none" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[12px] text-muted mt-2 font-medium">{s.label}</div>
          </Link>
        ))}
      </section>

      {/* ── Parliament composition ───────────────────────── */}
      {parliamentParties.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-3.5">
            <h2 className="font-serif text-[20px] font-normal text-foreground">Componența Parlamentului</h2>
            <span className="text-[12.5px] text-muted">{totalSenators} <span className="font-semibold">{countNoun(totalSenators, 'parlamentar', 'parlamentari')}</span></span>
          </div>
          <ParliamentBar parties={parliamentParties} total={totalSenators} />
        </section>
      )}

      {/* ── Vote list + cohesion sidebar ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-x-12 gap-y-10 items-start">

        {/* Recent votes — min-w-0: grid items default to min-width auto, so the
            nowrap official-title line would blow the column out to full title
            width and force horizontal scrolling on the whole page */}
        <section className="min-w-0">
          <h2 className="font-serif text-[20px] font-normal text-foreground border-b-2 border-sidebar pb-[5px] mb-2">
            Voturi recente
          </h2>
          {/* 12 days without votes reads as "abandoned site" when it's just recess */}
          {(() => {
            const last = recentVotes[0]?.vote_date
            const quiet = last && Date.now() - new Date(last).getTime() > 7 * 86_400_000
            const recess = quiet ? recessUntil() : null
            return recess ? (
              <p className="text-[12.5px] text-muted bg-raised rounded-md px-3 py-2 mt-2 mb-1">
                Parlamentul e în vacanță până la {recess} — de aceea nu apar voturi noi.
              </p>
            ) : null
          })()}
          {recentVotes.map(vote => {
            const tot = (vote.for_count ?? 0) + (vote.against_count ?? 0) + (vote.abstention_count ?? 0)
            return (
              <Link key={vote.id} href={`/voturi/${vote.id}`} className="block py-[18px] border-b border-rim hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--sidebar-bg)' }}>
                    {vote.laws?.code ?? 'Plen'}
                  </span>
                  <span className="text-[9px] uppercase font-semibold bg-raised text-faint px-[5px] py-[1px] rounded-[3px]">
                    {vote.chamber === 'deputies' ? 'Camera' : 'Senat'}
                  </span>
                  {vote.laws?.law_category && (
                    <CategoryBadge category={vote.laws.law_category} className="text-[9px] uppercase font-semibold px-[5px] py-[1px] rounded-[3px]" href={null} />
                  )}
                  <span className="text-[11px] text-faint ml-auto">{formatDate(vote.vote_date)}</span>
                  <OutcomeBadge outcome={vote.outcome} />
                </div>
                {/* hierarchy: plain-language summary is the headline, the official
                    title stays visible underneath as the verifiable receipt —
                    an AI headline with no official anchor reads as editorializing */}
                {vote.laws?.summary ? (
                  <>
                    <h3 className="font-serif text-[17px] leading-[1.3] text-foreground line-clamp-2">
                      {vote.laws.summary}
                    </h3>
                    <p className="flex items-center gap-1.5 text-[12px] text-faint mt-1 min-w-0">
                      {vote.laws.summary_is_ai && (
                        <span className="text-[9px] uppercase font-semibold bg-raised px-[5px] py-[1px] rounded-[3px] flex-shrink-0">
                          rezumat AI
                        </span>
                      )}
                      <span className="truncate min-w-0 flex-1">{capFirst(vote.laws.title)}</span>
                    </p>
                  </>
                ) : (
                  <h3 className="font-serif text-[17px] leading-[1.3] text-foreground line-clamp-1">
                    {capFirst(vote.laws?.title ?? vote.description ?? '') || 'Vot procedural (fără lege identificată)'}
                  </h3>
                )}
                <div className="flex items-center gap-3 mt-2.5">
                  <div className="flex h-[6px] flex-1 rounded-[3px] overflow-hidden bg-raised">
                    {(vote.for_count ?? 0) > 0 && <div style={{ flex: vote.for_count ?? 0, backgroundColor: 'var(--color-for)' }} />}
                    {(vote.against_count ?? 0) > 0 && <div style={{ flex: vote.against_count ?? 0, backgroundColor: 'var(--color-against)' }} />}
                    {(vote.abstention_count ?? 0) > 0 && <div style={{ flex: vote.abstention_count ?? 0, backgroundColor: 'var(--color-abstention)' }} />}
                  </div>
                  <span className="text-[12px] tabular-nums flex-shrink-0 font-medium">
                    <span style={{ color: 'var(--color-for)' }}>{vote.for_count ?? 0} pentru</span>
                    <span className="text-faint"> · </span>
                    <span style={{ color: 'var(--color-against)' }}>{vote.against_count ?? 0} împotrivă</span>
                    <span className="text-faint"> · </span>
                    <span style={{ color: 'var(--color-abstention)' }}>{vote.abstention_count ?? 0} {(vote.abstention_count ?? 0) === 1 ? 'abținere' : 'abțineri'}</span>
                  </span>
                </div>
              </Link>
            )
          })}
          {recentVotes.length >= 8 && (
            <Link href="/voturi" className="inline-block mt-5 text-[13px] text-muted hover:text-foreground transition-colors">
              Toate voturile →
            </Link>
          )}
        </section>

        {/* Sidebar: mini map + cohesion + shame corner */}
        {cohesionData.length > 0 && (
          <aside>
            {/* personal hook at the top of the sidebar — "find your MP"
                converts a first-time visitor, an email form doesn't */}
            <div className="flex items-baseline justify-between border-b-2 border-sidebar pb-[5px] mb-3">
              <h2 className="font-serif text-[16px] font-normal text-foreground">Cine te reprezintă?</h2>
              <Link href="/parlamentarul-tau" className="text-[11px] text-muted hover:text-foreground transition-colors">
                Toți parlamentarii →
              </Link>
            </div>
            <p className="text-[11px] text-faint mb-2">Apasă pe județul tău.</p>
            <div className="mb-10">
              <CountyMap />
            </div>

            {/* Absențe — top 5: lowest plenary presence, both chambers */}
            {lowPresence.length > 0 && (
              <>
                <h2 className="font-serif text-[16px] font-normal text-foreground border-b-2 border-respins/60 pb-[5px] mb-1">
                  Absențe — top 5
                </h2>
                <p className="text-[11px] text-faint mb-3">absențe la voturile din plen · Senat + Cameră · fără membrii Guvernului</p>
                <div className="space-y-2">
                  {lowPresence.map(s => (
                    <Link
                      key={s.politician_id}
                      href={s.href}
                      className="flex items-center justify-between gap-2 bg-surface border border-rim rounded-lg px-3 py-2 hover:bg-raised transition-colors"
                    >
                      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-foreground min-w-0">
                        <span className="w-[9px] h-[9px] rounded-[2px] flex-shrink-0" style={{ backgroundColor: s.party_color || '#9e9e9e' }} />
                        <span className="truncate">{s.first_name} {s.name}</span>
                      </span>
                      <span className="text-[13px] font-bold tabular-nums text-respins flex-shrink-0">{Math.round(100 - s.presence_pct)}%</span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            <h2 className="font-serif text-[16px] font-normal text-foreground border-b-2 border-sidebar pb-[5px] mb-1 mt-2">
              Coeziune partide
            </h2>
            <p
              className="text-[11px] text-faint mb-3"
              title={`Vot disputat = tabăra minoritară (pentru vs. împotrivă + abțineri) a strâns cel puțin ${CONTESTED_MIN_PCT}% din voturile exprimate. Voturile aproape unanime nu diferențiază partidele.`}
            >
              doar voturi disputate (minoritatea ≥ {CONTESTED_MIN_PCT}% din voturile exprimate)
            </p>
            <div className="space-y-2">
              {cohesionData.map(c => (
                <Link
                  key={c.party_id}
                  href={`/partide/${c.abbreviation}`}
                  className="flex items-center justify-between bg-surface border border-rim rounded-lg px-3 py-2 hover:bg-raised transition-colors"
                  style={{ borderLeftWidth: 3, borderLeftColor: c.color }}
                >
                  <span className="text-[13px] font-medium text-foreground">{c.abbreviation}</span>
                  {/* one decimal — whole-percent rounding collapses 99.3 and 98.5 into the same "99" */}
                  <span className="text-[13px] font-semibold tabular-nums text-foreground">{c.cohesion_pct?.toFixed(1)}%</span>
                </Link>
              ))}
            </div>

            <h2 className="font-serif text-[16px] font-normal text-foreground border-b-2 border-sidebar pb-[5px] mb-3 mt-10">
              Parlamentul, pe email
            </h2>
            <NewsletterForm compact />

          </aside>
        )}
      </div>
    </div>
  )
}
