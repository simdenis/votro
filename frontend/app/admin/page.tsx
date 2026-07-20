import { createHmac } from 'node:crypto'
import { getDB } from '@/lib/supabase'
import { PublishCard, CarouselPublishCard, ManualPublish } from '@/components/admin/publish-panel'
import { AdminLogin, LogoutButton } from '@/components/admin/admin-login'
import { isAdmin } from '@/lib/admin-auth'
import { lawSlides, lawCarouselCaption, initiatorLineFromRows, CARD_V, type Slide } from '@/lib/ig-carousel'
import { getSwitchers, type Switcher } from '@/lib/switchers'
import type { LawStatus } from '@/lib/types'

// Curation dashboard: every posting cadence as a section — see the cards,
// pick, publish to Instagram. Auth via an httpOnly cookie (set by
// /api/admin/login) — no admin key in the URL or the page HTML; unauthenticated
// visitors get the login form instead. Publish calls carry the cookie
// automatically (same-origin).
//
// ?img=<b64url>&cap=<b64url> prefill the manual form — the monthly absence
// approval email links here (via the login exchange) with the signed
// shamecard URL + caption.

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Admin — postări',
  robots: { index: false, follow: false },
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')
const CANDIDATE_DAYS = 14
const HASHTAGS = '#parlament #transparență #românia #politică #laButoane'

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                   'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']
const RO_MONTHS_S = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']

const STATUS_LINE: Record<string, string> = {
  promulgat: 'Promulgată — urmează publicarea în Monitorul Oficial.',
  retrimis: 'Retrimisă de Președinte în Parlament pentru reexaminare.',
  sesizat_ccr: 'Contestată la Curtea Constituțională.',
}

function b64urlDecode(s: string | undefined): string {
  if (!s) return ''
  try { return Buffer.from(s, 'base64url').toString('utf8') } catch { return '' }
}

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url')
}

/** Mirror of the poster's _sign_card — HMAC the b64url payload. */
function signCard(d: string): string | null {
  const secret = process.env.CARD_SIGN_SECRET
  if (!secret) return null
  return createHmac('sha256', secret).update(d).digest('hex').slice(0, 32)
}

function roDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${RO_MONTHS_S[m - 1]} ${y}`
}

const EVENT_LABEL: Record<string, string> = {
  promulgat: 'promulgată', retrimis: 'retrimisă de Președinte', sesizat_ccr: 'sesizare CCR',
}

// ── candidates (weekly: promulgated / returned / final votes) ────────────────

type FinalVote = {
  law_id: string; chamber: string; vote_date: string | null
  for_count: number | null; against_count: number | null; outcome: string | null
}

async function fetchCandidates() {
  const db = getDB()
  const cutoff = new Date(Date.now() - CANDIDATE_DAYS * 86400_000).toISOString().slice(0, 10)

  const [{ data: votes }, { data: presLaws }] = await Promise.all([
    db.from('votes')
      .select('law_id, chamber, vote_date, for_count, against_count, outcome')
      .eq('vote_type', 'vot final').not('law_id', 'is', null).gte('vote_date', cutoff),
    db.from('laws').select('id').gte('presidential_date', cutoff),
  ])

  const votesByLaw = new Map<string, FinalVote[]>()
  for (const v of (votes ?? []) as FinalVote[]) {
    votesByLaw.set(v.law_id, [...(votesByLaw.get(v.law_id) ?? []), v])
  }
  const ids = [...new Set([...votesByLaw.keys(), ...(presLaws ?? []).map(l => l.id)])]
  if (!ids.length) return []

  const { data: laws } = await getDB()
    .from('laws')
    .select('id, code, title, summary, headline, presidential_status, presidential_date, interest_score, interest_reason, initiator_type')
    .in('id', ids)
  const top = (laws ?? [])
    .sort((a, b) => (b.interest_score ?? -1) - (a.interest_score ?? -1))
    .slice(0, 10)
    .map(l => {
      const last = (votesByLaw.get(l.id) ?? [])
        .sort((a, b) => (b.vote_date ?? '').localeCompare(a.vote_date ?? ''))[0]
      return { ...l, lastVote: last ?? null }
    })

  // Batched extras for the carousel decks: chamber votes/status, initiator
  // lists (caption), and per-vote deviation counts (deviation slide).
  const topIds = top.map(l => l.id)
  const [{ data: statuses }, { data: initiators }] = await Promise.all([
    db.from('law_status').select('*').in('law_id', topIds),
    db.from('law_initiators').select('law_id, role_raw, party_raw').in('law_id', topIds),
  ])
  const statusByLaw = new Map((statuses ?? []).map(s => [s.law_id, s as LawStatus]))
  const voteIds = (statuses ?? [])
    .flatMap(s => [s.senate_vote_id, s.camera_vote_id])
    .filter((v): v is string => Boolean(v))
  const { data: devRows } = voteIds.length
    ? await db.from('politician_votes').select('vote_id').in('vote_id', voteIds).eq('party_line_deviation', true)
    : { data: [] }
  const devByVote = new Map<string, number>()
  for (const r of devRows ?? []) devByVote.set(r.vote_id, (devByVote.get(r.vote_id) ?? 0) + 1)

  return top.map(l => {
    const status = statusByLaw.get(l.id) ?? null
    let devVote: string | null = null, devCount = 0
    for (const vid of [status?.senate_vote_id, status?.camera_vote_id]) {
      if (vid && (devByVote.get(vid) ?? 0) > devCount) { devVote = vid; devCount = devByVote.get(vid)! }
    }
    const initiator = initiatorLineFromRows(l.initiator_type,
      (initiators ?? []).filter(r => r.law_id === l.id))
    return {
      ...l,
      slides: status ? lawSlides(status, devVote) : ([] as Slide[]),
      carouselCaption: status ? lawCarouselCaption(status, { initiator, devCount, headline: l.headline }) : null,
    }
  })
}

type Candidate = Awaited<ReturnType<typeof fetchCandidates>>[number]

function lawCaption(l: Candidate): string {
  // lead with the catchy AI headline when present — the hook people read
  const lines = [l.headline ? `📋 ${l.headline}` : `📋 ${l.code} — pe scurt`, '']
  if (l.summary) lines.push(l.summary.length > 500 ? l.summary.slice(0, 497).trimEnd() + '…' : l.summary, '')
  if (l.presidential_status && STATUS_LINE[l.presidential_status]) {
    lines.push(STATUS_LINE[l.presidential_status], '')
  } else if (l.lastVote) {
    const ch = l.lastVote.chamber === 'senate' ? 'Senat' : 'Camera Deputaților'
    const oc = l.lastVote.outcome === 'respins' ? 'Respinsă' : 'Adoptată'
    lines.push(`${oc} în ${ch}: ${l.lastVote.for_count ?? 0} pentru, ${l.lastVote.against_count ?? 0} împotrivă.`, '')
  }
  lines.push(`Cum a votat fiecare parlamentar: ${SITE}/legi/${l.id} (link în bio)`, '', HASHTAGS)
  return lines.join('\n')
}

/** The recent decisive event that put this law on the candidates list. */
function qualifyingEvent(l: Candidate): string {
  if (l.presidential_status && l.presidential_date) {
    return `${EVENT_LABEL[l.presidential_status] ?? l.presidential_status} · ${roDate(l.presidential_date)}`
  }
  if (l.lastVote) {
    const ch = l.lastVote.chamber === 'senate' ? 'Senat' : 'Cameră'
    return `vot final ${ch} (${l.lastVote.outcome ?? '—'}) · ${roDate(l.lastVote.vote_date)}`
  }
  return ''
}

// ── weekly: tacit deadlines ──────────────────────────────────────────────────

async function fetchTacit() {
  const today = new Date().toISOString().slice(0, 10)
  const limit = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)
  const { data } = await getDB().from('pending_bills')
    .select('code, title, summary, chamber, tacit_deadline, interest_score, interest_reason')
    .gte('tacit_deadline', today).lte('tacit_deadline', limit)
    .order('interest_score', { ascending: false, nullsFirst: false })
    .order('tacit_deadline', { ascending: true })
    .limit(10)
  return data ?? []
}

// ── monthly: last-month top-10 absents (matview from migration 036) ──────────

type MonthlyAbsRow = {
  politician_id: string; name: string; first_name: string; chamber: string
  party_abbr: string | null; party_color: string | null
  gov_role: string | null; context_note: string | null; mandate_start: string | null
  month: string; held: number; present: number; absent: number; absence_pct: number
}

async function fetchMonthlyAbsents() {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  const label = `${RO_MONTHS[prev.getMonth()]} ${prev.getFullYear()}`
  const monthStart = `${month}-01`
  const { data, error } = await getDB().from('politician_monthly_absences')
    .select('*').eq('month', month).eq('active', true)
  if (error) return { month, label, missing: true as const, entries: [] }
  const rows = (data ?? []) as MonthlyAbsRow[]
  // same guardrails as the poster: gov excluded, context_note excluded, seated
  // the whole month, chambers with <5 votes dropped
  const heldByChamber = new Map<string, number>()
  for (const r of rows) heldByChamber.set(r.chamber, r.held)
  const entries = rows
    .filter(r => !r.gov_role && !r.context_note
      && (r.mandate_start ?? '2000-01-01') <= monthStart
      && (heldByChamber.get(r.chamber) ?? 0) >= 5)
    .sort((a, b) => (b.absent / b.held) - (a.absent / a.held))
    .slice(0, 10)
    .map(r => ({
      n: `${r.first_name} ${r.name}`, p: r.party_abbr ?? 'IND', c: r.party_color ?? '#9e9e9e',
      ch: r.chamber === 'senate' ? 'SENAT' : 'CAMERĂ',
      a: Math.round(r.absent / r.held * 100), x: r.absent, h: r.held,
    }))
  return { month, label, missing: false as const, entries }
}

// ── quarterly matrix window ──────────────────────────────────────────────────

function lastQuarter(): { from: string; to: string; label: string } {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3) // current quarter 0-3
  const y = q === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const prevQ = q === 0 ? 3 : q - 1
  const m0 = prevQ * 3
  const pad = (m: number) => String(m + 1).padStart(2, '0')
  return { from: `${y}-${pad(m0)}`, to: `${y}-${pad(m0 + 2)}`, label: `T${prevQ + 1} ${y}` }
}

// ── page ─────────────────────────────────────────────────────────────────────

function Section({ title, cadence, hint, children }: {
  title: string; cadence: string; hint?: string; children: React.ReactNode
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="text-[15px] font-bold">{title}</h2>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-faint border border-rim rounded px-1.5 py-px">{cadence}</span>
      </div>
      {hint && <p className="text-[12px] text-faint mt-0.5">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function CandidateBlock({ l, i }: { l: Candidate; i: number }) {
  return (
    <div className="border border-rim rounded-xl p-4">
      <div className="flex items-baseline gap-2 flex-wrap mb-3">
        <span className="text-[13px] font-bold">{l.code}</span>
        <span className="text-[11px] font-medium text-adoptat">{qualifyingEvent(l)}</span>
        {l.interest_score != null && (
          <span className="text-[11px] text-faint">interes {l.interest_score}/100{l.interest_reason ? ` — ${l.interest_reason}` : ''}</span>
        )}
      </div>
      <p className="text-[12.5px] text-muted mb-3">{l.title.length > 160 ? l.title.slice(0, 157) + '…' : l.title}</p>
      {l.slides.length > 0 ? (
        <CarouselPublishCard
         
          slides={l.slides.map(s => ({ url: `${SITE}${s.static}`, label: s.label }))}
          fallbackImage={`${SITE}/api/og/${l.slides[0].suffix}`}
          initialCaption={l.carouselCaption ?? lawCaption(l)}
          command={`cd frontend && node scripts/render-ig.mjs ${l.id} && npm run deploy`}
        />
      ) : (
        <PublishCard image={`${SITE}/api/og/summarycard?id=${l.id}`}
                     initialCaption={lawCaption(l)} stagger={i * 900} />
      )}
    </div>
  )
}

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ img?: string; cap?: string }>
}) {
  // Auth via httpOnly cookie (set by /api/admin/login) — no key in the URL.
  if (!(await isAdmin())) return <AdminLogin />
  const sp = await searchParams

  const today = new Date().toISOString().slice(0, 10)
  const thisMonth = today.slice(0, 7)
  const db = getDB()

  const [candidates, tacit, monthlyAbs, allSwitchers, { data: todayVotes }] = await Promise.all([
    fetchCandidates(),
    fetchTacit(),
    fetchMonthlyAbsents(),
    getSwitchers(),
    db.from('votes').select('law_id, chamber, outcome, laws(id, code, title)')
      .eq('vote_type', 'vot final').eq('vote_date', today).not('law_id', 'is', null),
  ])

  const promulgated = candidates.filter(l => l.presidential_status === 'promulgat')
  const returned = candidates.filter(l => l.presidential_status === 'retrimis' || l.presidential_status === 'sesizat_ccr')
  const voteOnly = candidates.filter(l => !l.presidential_status)

  const monthSwitchers = allSwitchers.filter((s: Switcher) => {
    const last = s.segments[s.segments.length - 1]
    return last && (last.from_date ?? '').startsWith(thisMonth)
  })
  const todaySwitchers = allSwitchers.filter((s: Switcher) => {
    const last = s.segments[s.segments.length - 1]
    return last && last.from_date === today
  })

  const quarter = lastQuarter()
  const prefillImg = b64urlDecode(sp.img)
  const prefillCap = b64urlDecode(sp.cap)

  // signed shamecard URL for last month's top-10 (same contract as the poster)
  let absImage: string | null = null, absCaption = ''
  if (!monthlyAbs.missing && monthlyAbs.entries.length) {
    const d = b64url(JSON.stringify(monthlyAbs.entries))
    const sig = signCard(d)
    if (sig) {
      absImage = `${SITE}/api/og/shamecard?d=${d}&label=${encodeURIComponent(monthlyAbs.label)}&sig=${sig}`
      absCaption = [
        `🔴 Absențe — ${monthlyAbs.label}: top ${monthlyAbs.entries.length} cei mai absenți parlamentari`, '',
        ...monthlyAbs.entries.map((e, i) => `${i + 1}. ${e.n} (${e.p}, ${e.ch}) — ${e.a}% absențe (${e.x}/${e.h} voturi)`),
        '', 'Doar parlamentarii activi toată perioada, fără cei cu notă de context (concediu/delegație). Membrii Guvernului nu sunt incluși.',
        '', `Toată lista: ${SITE}`, '', '#parlament #absenteism #laButoane #transparență #românia',
      ].join('\n')
    }
  }

  const tacitCaption = tacit.length ? [
    '⏳ Legi pe cale să treacă TACIT — fără niciun vot', '',
    'Dacă termenul constituțional expiră fără vot, proiectul e considerat adoptat automat (art. 75). Termene care expiră în următoarele 7 zile:', '',
    ...tacit.map((b, i) => `${i + 1}. ${b.summary || b.title || b.code} (${b.code}, ${b.chamber === 'senate' ? 'Senat' : 'Cameră'}) — termen ${roDate(b.tacit_deadline)}`),
    '', `Lista completă: ${SITE}/tacite`, '', HASHTAGS,
  ].join('\n') : ''

  const switchCaption = monthSwitchers.length ? [
    `🔄 Traseism — ${RO_MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`, '',
    ...monthSwitchers.map(s => {
      const from = s.segments[s.segments.length - 2], to = s.segments[s.segments.length - 1]
      return `• ${s.first_name} ${s.name} (${s.chamber === 'senate' ? 'Senat' : 'Cameră'}): ${from?.abbreviation ?? '?'} → ${to?.abbreviation ?? '?'}`
    }),
    '', `Parcursul fiecăruia: ${SITE}/traseisti`, '', HASHTAGS,
  ].join('\n') : ''

  const matrixCaption = [
    `🤝 Cine votează cu cine — ${quarter.label}`, '',
    'Procentul de voturi disputate în care partidele au votat la fel, două câte două. Voturile aproape unanime sunt excluse — doar cele care chiar despart plenul.', '',
    `Explorează matricea interactivă: ${SITE}/analize`, '', HASHTAGS,
  ].join('\n')

  return (
    <div className="max-w-[860px]">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold">Postări — alege și publică</h1>
        <LogoutButton />
      </div>
      <p className="text-[13px] text-muted mt-1">
        Publicarea merge direct pe @vot.romania — butonul cere o a doua apăsare de confirmare.
        Nimic nu se postează singur.
      </p>

      {(prefillImg || prefillCap) && (
        <Section title="Din emailul de aprobare" cadence="email">
          <ManualPublish initialImages={prefillImg} initialCaption={prefillCap} />
        </Section>
      )}

      {(todayVotes ?? []).length + todaySwitchers.length > 0 && (
        <Section title="Astăzi" cadence="zilnic"
                 hint="Voturi finale de azi și schimbări de partid de azi — de regulă story (fără caption, 24h), dar ai și butonul de post.">
          <div className="flex flex-col gap-6">
            {(todayVotes ?? []).map((v: any) => (
              <div key={v.law_id} className="border border-rim rounded-xl p-4">
                <p className="text-[12.5px] font-medium mb-2">
                  {v.laws?.code} — vot final {v.chamber === 'senate' ? 'Senat' : 'Cameră'} ({v.outcome})
                </p>
                <PublishCard image={`${SITE}/api/og/summarycard?id=${v.law_id}&v=${CARD_V}`}
                             initialCaption={`${v.laws?.code} — vot final azi în ${v.chamber === 'senate' ? 'Senat' : 'Camera Deputaților'} (${v.outcome}).\n\nDetalii: ${SITE}/legi/${v.law_id} (link în bio)\n\n${'#parlament #transparență #românia #laButoane'}`} />
              </div>
            ))}
            {todaySwitchers.length > 0 && (
              <div className="border border-rim rounded-xl p-4">
                <p className="text-[12.5px] font-medium mb-2">Schimbare de partid azi: {todaySwitchers.map(s => `${s.first_name} ${s.name}`).join(', ')}</p>
                <PublishCard image={`${SITE}/api/og/switchcard?month=${thisMonth}`} initialCaption={switchCaption} />
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title="Promulgate de Președinte" cadence="săptămânal"
               hint={`Legi promulgate în ultimele ${CANDIDATE_DAYS} zile, sortate după interes. Carusel complet = publicabil direct; „nerandat" = rulează comanda de randare.`}>
        <div className="flex flex-col gap-6">
          {promulgated.length === 0 && <p className="text-[13px] text-faint">Nicio promulgare recentă.</p>}
          {promulgated.map((l, i) => <CandidateBlock key={l.id} l={l} i={i} />)}
        </div>
      </Section>

      <Section title="Retrimise / contestate de Președinte" cadence="săptămânal"
               hint="Legi retrimise în Parlament sau trimise la CCR — de obicei cele mai controversate.">
        <div className="flex flex-col gap-6">
          {returned.length === 0 && <p className="text-[13px] text-faint">Nimic retrimis sau contestat recent.</p>}
          {returned.map((l, i) => <CandidateBlock key={l.id} l={l} i={i} />)}
        </div>
      </Section>

      {voteOnly.length > 0 && (
        <Section title="Vot final recent (încă la Președinte)" cadence="săptămânal">
          <div className="flex flex-col gap-6">
            {voteOnly.map((l, i) => <CandidateBlock key={l.id} l={l} i={i} />)}
          </div>
        </Section>
      )}

      <Section title="Pe cale să treacă tacit (≤ 7 zile)" cadence="săptămânal"
               hint="Termene constituționale care expiră în 7 zile — cele mai fierbinți primele (scor AI din expunerea de motive), la egalitate cel mai apropiat termen.">
        {tacit.length === 0 ? (
          <p className="text-[13px] text-faint">Niciun termen tacit în următoarele 7 zile.</p>
        ) : (
          <div className="border border-rim rounded-xl p-4">
            <PublishCard image={`${SITE}/api/og/tacitlist?d=${today}`} initialCaption={tacitCaption} />
          </div>
        )}
      </Section>

      <Section title={`Absenți — ${monthlyAbs.label}, top 10`} cadence="lunar"
               hint="Aceleași reguli ca postarea lunară: fără membri ai Guvernului, fără cei cu notă de context, doar mandate întregi.">
        {monthlyAbs.missing ? (
          <p className="text-[13px] text-respins">Tabelul „politician_monthly_absences" lipsește — rulează migrația 036 în Supabase SQL editor, apoi refresh-ul rulează zilnic de pe VPS.</p>
        ) : !absImage ? (
          <p className="text-[13px] text-faint">Nicio lună completă cu date suficiente (sau CARD_SIGN_SECRET lipsă).</p>
        ) : (
          <div className="border border-rim rounded-xl p-4">
            <PublishCard image={absImage} initialCaption={absCaption} />
          </div>
        )}
      </Section>

      <Section title="Traseiști luna aceasta" cadence="lunar"
               hint="Se sare peste lună dacă nimeni nu a schimbat partidul.">
        {monthSwitchers.length === 0 ? (
          <p className="text-[13px] text-faint">0 traseiști luna asta — nimic de postat. ✓</p>
        ) : (
          <div className="border border-rim rounded-xl p-4">
            <PublishCard image={`${SITE}/api/og/switchcard?month=${thisMonth}`} initialCaption={switchCaption} />
          </div>
        )}
      </Section>

      <Section title={`Matricea partidelor — ${quarter.label}`} cadence="trimestrial"
               hint="Cine votează cu cine, pe voturile disputate din trimestrul încheiat.">
        <div className="border border-rim rounded-xl p-4">
          <PublishCard image={`${SITE}/api/og/matrix?from=${quarter.from}&to=${quarter.to}`} initialCaption={matrixCaption} />
        </div>
      </Section>

      <Section title="Postare manuală" cadence="oricând"
               hint={`Orice URL de card de pe ${SITE} — un URL pe linie, 2+ = carusel.`}>
        <div className="border border-rim rounded-xl p-4">
          <ManualPublish />
        </div>
      </Section>
      <div className="mb-8" />
    </div>
  )
}
