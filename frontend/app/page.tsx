import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { lawSlug, personSlug, plainSummary, todayRo, formatDate, recessUntil } from '@/lib/utils'
import { AbsenceTop } from '@/components/absence-top'
import { daysLeft } from '@/components/deadline-badge'
import { CountyMap } from '@/components/county-map'
import { getCountyLeaders } from '@/lib/county-leaders'
import { NewsletterForm } from '@/components/newsletter-form'

// ISR: CDN-cache the homepage for 10 min instead of rendering from origin on
// every hit — votes change daily at most, so freshness is unaffected while
// Fast Origin Transfer drops sharply.
export const revalidate = 600
// absolute: the "%s | LaButoane" template would burn the homepage SERP line on "Acasă"
export const metadata: Metadata = { title: { absolute: 'LaButoane — Cum votează Parlamentul României' } }

const ABS_COLS = 'politician_id, name, first_name, party_abbr, party_color, presence_pct, chamber_votes, context_note'

async function getAbsenceTop(db: ReturnType<typeof getDB>): Promise<{ senators: unknown[]; deputies: unknown[] }> {
  const { data } = await db.from('scrape_meta').select('value').eq('key', 'absence_top').maybeSingle()
  try {
    const v = data?.value ? JSON.parse(data.value) : null
    if (v?.senators?.length && v?.deputies?.length) return v
  } catch { /* fall through to the live query */ }
  const live = (view: string) => db.from(view).select(ABS_COLS)
    .eq('active', true).is('gov_role', null).is('context_note', null)
    .order('presence_pct', { ascending: true }).limit(15)
  const [s, d] = await Promise.all([live('senator_stats'), live('deputy_stats')])
  return { senators: s.data ?? [], deputies: d.data ?? [] }
}

type Decided = { law_id: string; code: string; text: string; date: string | null }

async function decided(db: ReturnType<typeof getDB>, stage: 'promulgat' | 'respins_definitiv'): Promise<Decided[]> {
  const { data } = await db.from('initiatives')
    .select('law_id, stage_date, laws(code, headline, summary, title)')
    .eq('stage', stage).not('law_id', 'is', null)
    .order('stage_date', { ascending: false }).limit(3)
  type Row = { law_id: string; stage_date: string | null; laws: { code: string; headline: string | null; summary: string | null; title: string } | null }
  return ((data ?? []) as unknown as Row[]).filter(r => r.laws).map(r => ({
    law_id: r.law_id,
    code: r.laws!.code,
    text: r.laws!.headline || plainSummary(r.laws!.summary) || r.laws!.title,
    date: r.stage_date,
  }))
}

export default async function Dashboard() {
  const db = getDB()

  // Romania's date, not UTC — after RO midnight (but before UTC midnight) the
  // UTC date is yesterday, which would keep just-expired tacit deadlines alive.
  const today = todayRo()
  const [promLaws, rejLaws, abs, r9, r10, leaders] = await Promise.all([
    // Decided recently: the last laws promulgated and the last ones rejected for
    // good (initiatives.stage, dated by stage_date), shown side by side. Short
    // headline when the law has one, else the plain summary.
    decided(db, 'promulgat'),
    decided(db, 'respins_definitiv'),
    // Absențe — precomputed daily by scraper/absence_top.py (scrape_meta.absence_top):
    // the live sort over the stats views times out under anon often enough to cache
    // an empty chamber. Same guards: no gov_role, no context_note (a teaser has no
    // room for the ⓘ caveat). Falls back to the live query when the row is missing.
    getAbsenceTop(db),
    // Legi tacite — soonest upcoming constitutional deadlines (art. 75). The one
    // thing that doesn't stop during recess, so it belongs on the homepage.
    db.from('pending_bills').select('id, code, title, summary, tacit_deadline')
      .not('tacit_deadline', 'is', null).gte('tacit_deadline', today)
      .order('tacit_deadline', { ascending: true }).limit(3),
    // Latest final vote — only its date, for the recess banner.
    db.from('votes').select('vote_date')
      .eq('vote_type', 'vot final').not('law_id', 'is', null)
      .order('vote_date', { ascending: false }).limit(1),
    getCountyLeaders(),
  ])

  type LowPresence = { politician_id: string; name: string; first_name: string; party_abbr: string; party_color: string; presence_pct: number; chamber_votes: number | null; context_note: string | null; href: string }
  // Split by chamber: a senator and a deputy have different denominators, so
  // ranking them in one list mixes incomparable numbers.
  const absSenators: LowPresence[] = (abs.senators as Omit<LowPresence, 'href'>[])
    .map(s => ({ ...s, href: `/senatori/${personSlug(s.first_name, s.name)}` }))
    .sort((a, b) => a.presence_pct - b.presence_pct)
  const absDeputies: LowPresence[] = (abs.deputies as Omit<LowPresence, 'href'>[])
    .map(s => ({ ...s, href: `/deputati/${personSlug(s.first_name, s.name)}` }))
    .sort((a, b) => a.presence_pct - b.presence_pct)
  const tacitBills = (r9.data ?? []) as { id: string; code: string; title: string | null; summary: string | null; tacit_deadline: string | null }[]
  // Recess banner (art. 66: parliament breaks Jul–Aug and Jan). Show it only
  // when there's genuinely no recent activity — extraordinary sessions happen.
  const lastVoteDate = (r10.data as { vote_date: string }[] | null)?.[0]?.vote_date
  const quiet  = lastVoteDate ? Date.now() - new Date(lastVoteDate).getTime() > 7 * 86_400_000 : true
  const recess = quiet ? recessUntil() : null

  return (
    <div>

      {/* ── Header ───────────────────────────────────────── */}
      <header className="mb-9">
       <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10">
        <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint mb-2.5">
          Parlamentul României · Legislatura 2024–2028
        </p>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Cum votează Parlamentul?
        </h1>
        {/* One line above the fold; sources and neutrality live on /despre */}
        <p className="text-[15px] text-muted leading-relaxed mt-3.5 max-w-2xl">
          Cum votează fiecare senator și deputat. Date oficiale, actualizate zilnic.
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
        </form>
        </div>

        {/* Newsletter in the hero's right column, where the Senate donut was */}
        <div className="lg:w-[300px] lg:flex-shrink-0 mt-8 lg:mt-9">
          <h2 className="font-serif text-[16px] font-normal text-foreground border-b-2 border-sidebar pb-[5px]">Parlamentul, pe email</h2>
          <p className="text-[12px] text-muted mt-2 mb-3">
            Ce s-a votat săptămâna asta: sâmbăta, pe scurt. Te poți dezabona oricând.{' '}
            <a href="/newsletter-exemplu" target="_blank" rel="noopener" className="underline decoration-rim underline-offset-2 hover:text-foreground">
              Vezi un exemplu
            </a>
          </p>
          <NewsletterForm compact hideNote />
        </div>
       </div>
      </header>


      {/* ── Vote list + cohesion sidebar ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-x-12 gap-y-10 items-start">

        {/* Recently promulgated laws — the "it's now law" feed, in plain language */}
        <section className="min-w-0">
          {recess && (
            <div className="border-t border-rim mb-6 py-3">
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
              <div className="flex items-baseline justify-between border-b-2 border-sidebar pb-[5px]">
                <h2 className="font-serif text-[20px] font-normal text-foreground">Legi care pot trece fără vot de prima cameră</h2>
                <Link href="/tacite" className="text-[11px] text-muted hover:text-foreground transition-colors">Toate</Link>
              </div>
              <div>
                {tacitBills.map(b => {
                  const days = b.tacit_deadline ? daysLeft(b.tacit_deadline) : null
                  return (
                    <Link
                      key={b.id}
                      href={`/tacite/${lawSlug(b.code)}`}
                      className="flex items-center justify-between gap-2 py-2.5 border-b border-rim hover:bg-raised/60 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium text-foreground leading-snug line-clamp-2">{plainSummary(b.summary) || b.title || b.code}</span>
                        <span className="block font-mono text-[10px] text-muted mt-1">{b.code}</span>
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

          <h2 className="font-serif text-[20px] font-normal text-foreground border-b-2 border-sidebar pb-[5px]">
            Decise recent
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-8">
            {([
              { label: 'Promulgate', color: 'var(--color-for-dark)', rows: promLaws, href: '/legi?tab=promulgate' },
              { label: 'Respinse definitiv', color: 'var(--color-against-dark)', rows: rejLaws, href: '/legi?tab=respinse' },
            ] as const).map(col => (
              <div key={col.label} className="min-w-0">
                <div className="flex items-baseline justify-between py-2 border-b border-rim">
                  <h3 className="text-[13px] font-semibold" style={{ color: col.color }}>{col.label}</h3>
                  <Link href={col.href} className="text-[11px] text-muted hover:text-foreground transition-colors">Toate</Link>
                </div>
                {col.rows.map(l => (
                  <Link
                    key={l.law_id}
                    href={`/legi/${lawSlug(l.code)}`}
                    className="block py-2.5 border-b border-rim hover:bg-raised/60 transition-colors"
                  >
                    <span className="block text-[13.5px] font-medium text-foreground leading-snug line-clamp-2">{l.text}</span>
                    <span className="flex items-center gap-2 mt-1 font-mono text-[10px] text-muted">
                      <span>{l.code}</span>
                      {l.date && <span>{formatDate(l.date)}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>

        </section>

        {/* Sidebar: find-your-MP map · top absences */}
        <aside>
            {/* personal hook at the top of the sidebar — "find your MP"
                converts a first-time visitor, an email form doesn't */}
            <div className="flex items-baseline justify-between border-b-2 border-sidebar pb-[5px] mb-3">
              <h2 className="font-serif text-[16px] font-normal text-foreground">Cine te reprezintă?</h2>
            </div>
            <p className="text-[11px] text-faint mb-2">Apasă pe județul tău.</p>
            <div className="mb-10">
              <CountyMap leaders={leaders} />
            </div>

            {/* Absențe — lowest plenary presence, split Senat / Cameră */}
            {(absSenators.length > 0 || absDeputies.length > 0) && (
              <>
                {/* caveats live on the methodology page; the link stays as the one pointer */}
                <div className="flex items-baseline justify-between border-b-2 border-sidebar pb-[5px] mb-3">
                  <h2 className="font-serif text-[16px] font-normal text-foreground">Cine lipsește cel mai mult</h2>
                  <Link href="/despre#metodologie-absente" className="text-[11px] text-muted hover:text-foreground transition-colors">Metodologie</Link>
                </div>
                <AbsenceTop senators={absSenators} deputies={absDeputies} />
              </>
            )}

          </aside>
      </div>
    </div>
  )
}
