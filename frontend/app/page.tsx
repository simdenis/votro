import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { countNoun, lawSlug, personSlug, todayRo, formatDate, recessUntil } from '@/lib/utils'
import { OutcomeBadge } from '@/components/outcome-badge'
import { AbsenceTop } from '@/components/absence-top'
import { ParliamentDonut } from '@/components/parliament-donut'
import { CountyMap } from '@/components/county-map'
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

  // Romania's date, not UTC — after RO midnight (but before UTC midnight) the
  // UTC date is yesterday, which would keep just-expired tacit deadlines alive.
  const today = todayRo()
  const [r0, r2, r3, r4, r5, r6, r7, r8, r9, r10] = await Promise.all([
    db.from('law_status').select('*', { count: 'exact', head: true }),
    // substantive votes only — presence checks / agenda changes drown the feed.
    // Fetch a wider window so the feed's sort + category filter + date slider
    // have real data to work over (RecentVotes filters/sorts client-side).
    // columns trimmed to what RecentVotes renders — select('*, laws(*)') shipped
    // every law's em_url/scraped_at/etc into the serialized client props twice
    // Recently promulgated laws — the "finished, now it's law" feed. More alive
    // than raw votes (which stop during recess) and reads in plain language.
    db.from('law_status')
      .select('law_id, code, title, summary, law_category, presidential_date')
      .eq('presidential_status', 'promulgat').not('presidential_date', 'is', null)
      .order('presidential_date', { ascending: false }).limit(5),
    db.from('law_status').select('*', { count: 'exact', head: true }).eq('presidential_status', 'promulgat'),
    db.from('law_status').select('*', { count: 'exact', head: true }).or('senate_outcome.eq.respins,camera_outcome.eq.respins'),
    db.from('parties').select('abbreviation, color, name'),
    db.from('politicians').select('party_id, parties(abbreviation)', { count: 'exact', head: false }).eq('active', true),
    // Absențe top 5 — lowest presence since mandate start, both chambers.
    // Government members (gov_role) never vote in plen — structural absence.
    db.from('senator_stats').select('politician_id, name, first_name, party_abbr, party_color, presence_pct, chamber_votes, context_note')
      .eq('active', true).is('gov_role', null)
      .order('presence_pct', { ascending: true }).limit(15),
    db.from('deputy_stats').select('politician_id, name, first_name, party_abbr, party_color, presence_pct, chamber_votes, context_note')
      .eq('active', true).is('gov_role', null)
      .order('presence_pct', { ascending: true }).limit(15),
    // Legi tacite — soonest upcoming constitutional deadlines (art. 75). The one
    // thing that doesn't stop during recess, so it belongs on the homepage.
    db.from('pending_bills').select('id, code, title, summary, tacit_deadline')
      .not('tacit_deadline', 'is', null).gte('tacit_deadline', today)
      .order('tacit_deadline', { ascending: true }).limit(5),
    // Voturi recente — final votes on a law, the raw "what parliament did" feed.
    // Goes quiet during recess (unlike promulgations), which is why the recess
    // banner sits above it.
    db.from('votes')
      .select('id, vote_date, chamber, outcome, description, laws(code, title, law_category)')
      .eq('vote_type', 'vot final').not('law_id', 'is', null)
      .order('vote_date', { ascending: false }).limit(8),
  ])

  const totalLaws     = r0.count ?? 0
  type PromLaw = { law_id: string; code: string; title: string; summary: string | null; law_category: string | null; presidential_date: string | null }
  const promLaws      = (r2.data as PromLaw[] | null) ?? []
  const promulgatedCount = r3.count ?? 0
  const respinsCount  = r4.count ?? 0
  const allParties    = r5.data ?? []
  type LowPresence = { politician_id: string; name: string; first_name: string; party_abbr: string; party_color: string; presence_pct: number; chamber_votes: number | null; context_note: string | null; href: string }
  // Split by chamber: a senator and a deputy have different denominators, so
  // ranking them in one list mixes incomparable numbers.
  const absSenators: LowPresence[] = ((r7.data ?? []) as Omit<LowPresence, 'href'>[])
    .map(s => ({ ...s, href: `/senatori/${personSlug(s.first_name, s.name)}` }))
    .sort((a, b) => a.presence_pct - b.presence_pct)
  const absDeputies: LowPresence[] = ((r8.data ?? []) as Omit<LowPresence, 'href'>[])
    .map(s => ({ ...s, href: `/deputati/${personSlug(s.first_name, s.name)}` }))
    .sort((a, b) => a.presence_pct - b.presence_pct)
  const tacitBills = (r9.data ?? []) as { id: string; code: string; title: string | null; summary: string | null; tacit_deadline: string | null }[]
  type RecentVote = { id: string; vote_date: string; chamber: string; outcome: 'adoptat' | 'respins' | null; description: string | null; laws: { code: string; title: string; law_category: string | null } | null }
  const recentVotes = (r10.data as unknown as RecentVote[] | null) ?? []
  // Recess banner (art. 66: parliament breaks Jul–Aug and Jan). Show it only
  // when there's genuinely no recent activity — extraordinary sessions happen.
  const lastVoteDate = recentVotes[0]?.vote_date
  const quiet  = lastVoteDate ? Date.now() - new Date(lastVoteDate).getTime() > 7 * 86_400_000 : true
  const recess = quiet ? recessUntil() : null

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
      <header className="mb-9">
       <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10">
        <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint mb-2.5">
          Parlamentul României · Legislatura 2024–2028
        </p>
        <h1 className="font-serif text-[42px] font-normal tracking-[-0.01em] leading-[1.04] text-foreground">
          Cum votează Parlamentul?
        </h1>
        {/* Above-the-fold clarity: what the site is, who it's for, why trust it —
            one neutral sentence, no scroll required. */}
        <p className="text-[15px] text-muted leading-relaxed mt-3.5 max-w-2xl">
          Urmărește cum votează fiecare senator și deputat: legi, prezență la vot și devieri de la
          linia de partid. Date din surse oficiale (senat.ro, cdep.ro), actualizate zilnic,
          gratuit și neafiliat politic.
        </p>

        {/* Search-anything: many visitors arrive wanting one person or one law.
            Plain GET form → /cautare (works with no JS). Covers name, party, code. */}
        <form action="/cautare" method="GET" className="mt-6 max-w-2xl" role="search">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                name="q"
                type="search"
                aria-label="Caută un parlamentar, un partid sau o lege"
                placeholder="Caută un parlamentar, un partid sau o lege…"
                className="w-full bg-surface border border-rim rounded-lg pl-10 pr-3 py-3 text-[15px] text-foreground placeholder:text-faint focus:outline-none focus:border-foreground/50 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="btn-tactile shrink-0 rounded-lg px-5 py-3 text-[14px] font-semibold text-white"
              style={{ background: 'var(--sidebar-bg)' }}
            >
              Caută
            </button>
          </div>
          <p className="text-[11.5px] text-faint mt-1.5">
            caută după nume, după partid <span className="text-muted">(ex. „PSD")</span> sau după codul legii <span className="text-muted">(ex. „L230/2025")</span>
          </p>
        </form>

        {/* Guided start — one primary path, lighter secondary options beneath, so
            the homepage isn't equal-weight everywhere. */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <Link
            href="/deputati"
            className="btn-tactile inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[14px] font-semibold text-white"
            style={{ background: 'var(--sidebar-bg)' }}
          >
            Începe de la deputați →
          </Link>
          <span className="text-[13px] text-faint">sau explorează</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
            {[
              { href: '/legi', label: 'Legi' },
              { href: '/voturi', label: 'Voturi recente' },
              { href: '/parlamentarul-tau', label: 'Parlamentarul tău' },
              { href: '/analize', label: 'Analize' },
            ].map(l => (
              <Link key={l.href} href={l.href} className="text-muted underline decoration-rim underline-offset-2 hover:text-foreground transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        </div>

        {parliamentParties.length > 0 && (
          <div className="lg:w-[290px] lg:flex-shrink-0 mt-8 lg:mt-9">
            <ParliamentDonut parties={parliamentParties} total={totalSenators} />
          </div>
        )}
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

      {/* ── Vote list + cohesion sidebar ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-x-12 gap-y-10 items-start">

        {/* Recently promulgated laws — the "it's now law" feed, in plain language */}
        <section className="min-w-0">
          {recess && (
            <div className="mb-6 rounded-lg border border-rim bg-raised/60 px-4 py-3">
              <p className="text-[13.5px] text-foreground font-medium">Parlamentul e în vacanță</p>
              <p className="text-[12px] text-muted mt-0.5 leading-relaxed">
                Sesiunea ordinară se reia pe {recess}, așa că nu se dau voturi noi
                {lastVoteDate ? `; ultimul a fost pe ${formatDate(lastVoteDate)}` : ''}. Termenele legilor
                tacite curg în continuare.
              </p>
            </div>
          )}

          {/* Legi tacite — the hero. Nobody else tracks tacit adoption, and the
              deadlines keep running during recess, so this is the live story
              when the plenary is quiet. Kept above the promulgated/vote feeds. */}
          {tacitBills.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between border-b-2 border-respins/60 pb-[5px] mb-1">
                <h2 className="font-serif text-[20px] font-normal text-foreground">Legi care pot trece fără vot</h2>
                <Link href="/tacite" className="text-[11px] text-muted hover:text-foreground transition-colors">Toate →</Link>
              </div>
              <p className="text-[11.5px] text-muted mb-3 leading-relaxed">
                Dacă prima cameră nu le dezbate în termenul din Constituție (art. 75), se consideră
                adoptate automat, fără ca cineva să voteze{recess ? '. Termenele curg și în vacanță' : ''}.
              </p>
              <div className="space-y-2">
                {tacitBills.map(b => {
                  const days = b.tacit_deadline
                    ? Math.ceil((new Date(b.tacit_deadline + 'T23:59:59+03:00').getTime() - Date.now()) / 86_400_000)
                    : null
                  return (
                    <Link
                      key={b.id}
                      href={`/tacite/${lawSlug(b.code)}`}
                      className="flex items-center justify-between gap-2 bg-surface border border-rim rounded-lg px-3 py-2.5 hover:bg-raised transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-foreground line-clamp-2 leading-snug">{b.summary || b.title || b.code}</span>
                        <span className="block font-mono text-[10px] text-muted mt-0.5">{b.code}</span>
                      </span>
                      {days != null && (
                        <span className={`text-[12px] font-bold tabular-nums flex-shrink-0 ${days <= 7 ? 'text-respins' : days <= 30 ? 'text-deviere' : 'text-muted'}`}>
                          {days} {days === 1 ? 'zi' : 'zile'}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          <h2 className="font-serif text-[20px] font-normal text-foreground border-b-2 border-sidebar pb-[5px] mb-2">
            Legi promulgate recent
          </h2>
          <div className="space-y-2">
            {promLaws.map(l => (
              <Link
                key={l.law_id}
                href={`/legi/${l.law_id}`}
                className="block bg-surface border border-rim rounded-lg px-3 py-2.5 hover:bg-raised transition-colors"
              >
                {/* plain-language summary is the headline; official title/code below */}
                <span className="block text-[13.5px] font-medium text-foreground leading-snug line-clamp-2">
                  {l.summary || l.title}
                </span>
                <span className="flex items-center gap-2 mt-1 font-mono text-[10px] text-muted">
                  <span>{l.code}</span>
                  <span className="text-adoptat font-semibold">Promulgată{l.presidential_date ? ` · ${formatDate(l.presidential_date)}` : ''}</span>
                </span>
              </Link>
            ))}
          </div>
          <Link href="/legi?status=promulgat" className="inline-block mt-5 text-[13px] text-muted hover:text-foreground transition-colors">
            Toate legile →
          </Link>

          {/* Voturi recente — the raw vote feed, alongside the "now it's law"
              feed above. Quiet during recess, hence the empty-state note. */}
          <div className="mt-10">
            <div className="flex items-baseline justify-between border-b-2 border-sidebar pb-[5px] mb-2">
              <h2 className="font-serif text-[20px] font-normal text-foreground">Voturi recente</h2>
              <Link href="/voturi" className="text-[11px] text-muted hover:text-foreground transition-colors">Toate →</Link>
            </div>
            {recentVotes.length === 0 ? (
              <p className="text-[13px] text-muted">
                Niciun vot final recent{recess ? `. Parlamentul e în vacanță până pe ${recess}.` : '.'}
              </p>
            ) : (
              <div className="space-y-2">
                {recentVotes.map(v => (
                  <Link
                    key={v.id}
                    href={`/voturi/${v.id}`}
                    className="block bg-surface border border-rim rounded-lg px-3 py-2.5 hover:bg-raised transition-colors"
                  >
                    <span className="block text-[13.5px] font-medium text-foreground leading-snug line-clamp-2">
                      {v.laws?.title || v.description || v.laws?.code}
                    </span>
                    <span className="flex items-center gap-2 mt-1 font-mono text-[10px] text-muted">
                      {v.laws?.code && <span>{v.laws.code}</span>}
                      <OutcomeBadge outcome={v.outcome} />
                      <span>{formatDate(v.vote_date)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

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

            {/* Absențe — lowest plenary presence, split Senat / Cameră */}
            {(absSenators.length > 0 || absDeputies.length > 0) && (
              <>
                <h2 className="font-serif text-[16px] font-normal text-foreground border-b-2 border-respins/60 pb-[5px] mb-1">
                  Absențe — clasament
                </h2>
                <p className="text-[11px] text-faint mb-2">
                  % din voturile de plen ținute în camera sa de la validarea mandatului ·
                  fără membrii Guvernului (nu votează în plen) ·{' '}
                  <Link href="/despre#metodologie-absente" className="underline underline-offset-2 hover:text-foreground">metodologie</Link>
                </p>
                <p className="text-[11px] text-muted mb-3">
                  O absență nu înseamnă automat chiul: în spate poate fi un concediu medical, o
                  delegație oficială sau un alt mandat. Arătăm cifra brută, iar unde știm motivul îl
                  marcăm cu „ⓘ".
                </p>
                <AbsenceTop senators={absSenators} deputies={absDeputies} />
              </>
            )}

            {/* Ia datele — compact open-data builder, tucked under the absence
                list; the full-width version used to live below the grid */}
            <div className="mt-10">
              <div className="flex items-baseline justify-between border-b-2 border-sidebar pb-[5px] mb-3">
                <h2 className="font-serif text-[16px] font-normal text-foreground">Ia datele</h2>
                <Link href="/date" className="text-[11px] text-muted hover:text-foreground transition-colors">API complet →</Link>
              </div>
              <ApiBuilder minimal />
            </div>
          </aside>
      </div>

      {/* ── Newsletter ───────────────────────────────────── */}
      <section className="mt-14 border-t-2 border-sidebar pt-8">
        <h2 className="font-serif text-[20px] font-normal text-foreground mb-1.5">Parlamentul, pe email</h2>
        <p className="text-[13px] text-muted mb-4 max-w-2xl">
          Un rezumat scurt al voturilor, direct în inbox.{' '}
          <a href="/newsletter-exemplu.html" target="_blank" rel="noopener" className="underline decoration-rim underline-offset-2 hover:text-foreground">
            Vezi un exemplu →
          </a>
        </p>
        <div className="max-w-md">
          <NewsletterForm />
        </div>
      </section>
    </div>
  )
}
