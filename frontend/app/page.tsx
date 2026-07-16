import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { countNoun, personSlug } from '@/lib/utils'
import { RecentVotes } from '@/components/recent-votes'
import { AbsenceTop } from '@/components/absence-top'
import { ParliamentBar } from '@/components/parliament-bar'
import { CountyMap } from '@/components/county-map'
import type { VoteWithLaw } from '@/lib/types'
import { NewsletterForm } from '@/components/newsletter-form'
import { ApiBuilder } from '@/components/api-builder'

// ISR: CDN-cache the homepage for 10 min instead of rendering from origin on
// every hit — votes change daily at most, so freshness is unaffected while
// Fast Origin Transfer drops sharply.
export const revalidate = 600
// absolute: the "%s | LaButoane" template would burn the homepage SERP line on "Acasă"
export const metadata: Metadata = { title: { absolute: 'LaButoane — Cum votează Parlamentul României' } }

export default async function Dashboard() {
  const db = getDB()

  const today = new Date().toISOString().slice(0, 10)
  const [r0, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
    db.from('law_status').select('*', { count: 'exact', head: true }),
    // substantive votes only — presence checks / agenda changes drown the feed.
    // Fetch a wider window so the feed's sort + category filter + date slider
    // have real data to work over (RecentVotes filters/sorts client-side).
    db.from('votes').select('*, laws(*)').not('law_id', 'is', null).order('vote_date', { ascending: false }).limit(120),
    db.from('law_status').select('*', { count: 'exact', head: true }).eq('presidential_status', 'promulgat'),
    db.from('law_status').select('*', { count: 'exact', head: true }).or('senate_outcome.eq.respins,camera_outcome.eq.respins'),
    db.from('parties').select('abbreviation, color, name'),
    db.from('politicians').select('party_id, parties(abbreviation)', { count: 'exact', head: false }).eq('active', true),
    // Absențe top 5 — lowest presence since mandate start, both chambers.
    // Government members (gov_role) never vote in plen — structural absence.
    db.from('senator_stats').select('politician_id, name, first_name, party_abbr, party_color, presence_pct, context_note')
      .eq('active', true).is('gov_role', null)
      .order('presence_pct', { ascending: true }).limit(15),
    db.from('deputy_stats').select('politician_id, name, first_name, party_abbr, party_color, presence_pct, context_note')
      .eq('active', true).is('gov_role', null)
      .order('presence_pct', { ascending: true }).limit(15),
    // Legi tacite — soonest upcoming constitutional deadlines (art. 75). The one
    // thing that doesn't stop during recess, so it belongs on the homepage.
    db.from('pending_bills').select('id, code, title, tacit_deadline, source_url')
      .not('tacit_deadline', 'is', null).gte('tacit_deadline', today)
      .order('tacit_deadline', { ascending: true }).limit(5),
  ])

  const totalLaws     = r0.count ?? 0
  const recentVotes   = (r2.data as VoteWithLaw[] | null) ?? []
  const promulgatedCount = r3.count ?? 0
  const respinsCount  = r4.count ?? 0
  const allParties    = r5.data ?? []
  type LowPresence = { politician_id: string; name: string; first_name: string; party_abbr: string; party_color: string; presence_pct: number; context_note: string | null; href: string }
  const lowPresence: LowPresence[] = [
    ...((r7.data ?? []) as Omit<LowPresence, 'href'>[]).map(s => ({ ...s, href: `/senatori/${personSlug(s.first_name, s.name)}` })),
    ...((r8.data ?? []) as Omit<LowPresence, 'href'>[]).map(s => ({ ...s, href: `/deputati/${personSlug(s.first_name, s.name)}` })),
  ].sort((a, b) => a.presence_pct - b.presence_pct).slice(0, 15)
  const tacitBills = (r9.data ?? []) as { id: string; code: string; title: string | null; tacit_deadline: string | null; source_url: string | null }[]

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
          <RecentVotes votes={recentVotes} />
          {recentVotes.length >= 8 && (
            <Link href="/voturi" className="inline-block mt-5 text-[13px] text-muted hover:text-foreground transition-colors">
              Toate voturile →
            </Link>
          )}

          {/* Legi tacite — soonest deadlines. Nobody else tracks tacit adoption,
              and the deadlines keep running during recess. Under the feed (not
              the sidebar) so it reads as primary content. */}
          {tacitBills.length > 0 && (
            <div className="mt-10">
              <div className="flex items-baseline justify-between border-b-2 border-sidebar pb-[5px] mb-1">
                <h2 className="font-serif text-[20px] font-normal text-foreground">Legi tacite — termene apropiate</h2>
                <Link href="/tacite" className="text-[11px] text-muted hover:text-foreground transition-colors">Toate →</Link>
              </div>
              <p className="text-[11px] text-faint mb-3">Proiecte adoptate <strong className="font-semibold">fără vot</strong> dacă nu sunt dezbătute la timp (art. 75).</p>
              <div className="space-y-2">
                {tacitBills.map(b => {
                  const days = b.tacit_deadline
                    ? Math.ceil((new Date(b.tacit_deadline + 'T23:59:59+03:00').getTime() - Date.now()) / 86_400_000)
                    : null
                  return (
                    <a
                      key={b.id}
                      href={b.source_url ?? '/tacite'}
                      target={b.source_url ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 bg-surface border border-rim rounded-lg px-3 py-2.5 hover:bg-raised transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-foreground truncate">{b.title ?? b.code}</span>
                        <span className="block font-mono text-[10px] text-muted">{b.code}</span>
                      </span>
                      {days != null && (
                        <span className={`text-[12px] font-bold tabular-nums flex-shrink-0 ${days <= 7 ? 'text-respins' : days <= 30 ? 'text-deviere' : 'text-muted'}`}>
                          {days} {days === 1 ? 'zi' : 'zile'}
                        </span>
                      )}
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* Sidebar: find-your-MP map · top absences · open data · newsletter */}
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
                  Absențe — clasament
                </h2>
                <p className="text-[11px] text-faint mb-3">absențe la voturile din plen · Senat + Cameră · fără membrii Guvernului</p>
                <AbsenceTop items={lowPresence} />
              </>
            )}

            {/* Ia datele — compact open-data builder, tucked under the absence
                list; the full-width version used to live below the grid */}
            <div className="mt-10">
              <div className="flex items-baseline justify-between border-b-2 border-sidebar pb-[5px] mb-3">
                <h2 className="font-serif text-[16px] font-normal text-foreground">Ia datele</h2>
                <Link href="/date" className="text-[11px] text-muted hover:text-foreground transition-colors">API complet →</Link>
              </div>
              <p className="text-[11px] text-faint mb-3">Alege ce vrei — imagine sau JSON, fără cont, fără cod.</p>
              <ApiBuilder minimal />
            </div>
          </aside>
      </div>

      {/* ── Newsletter ───────────────────────────────────── */}
      <section className="mt-14 border-t-2 border-sidebar pt-8">
        <h2 className="font-serif text-[20px] font-normal text-foreground mb-1.5">Parlamentul, pe email</h2>
        <p className="text-[13px] text-muted mb-4 max-w-2xl">
          Un rezumat scurt al voturilor, direct în inbox. Fără spam.
        </p>
        <div className="max-w-md">
          <NewsletterForm />
        </div>
      </section>
    </div>
  )
}
