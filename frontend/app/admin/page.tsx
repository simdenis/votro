import { notFound } from 'next/navigation'
import { getDB } from '@/lib/supabase'
import { PublishCard, CarouselPublishCard, ManualPublish } from '@/components/admin/publish-panel'
import { lawSlides, lawCarouselCaption, initiatorLineFromRows, type Slide } from '@/lib/ig-carousel'
import type { LawStatus } from '@/lib/types'

// Curation dashboard: see the candidate cards, pick, publish to Instagram.
// Gated by ?key=<ADMIN_KEY> (worker secret) — anything else 404s, so the page
// doesn't exist for the public. The key is embedded in the served HTML for the
// publish calls, which is fine: only the key holder ever gets this HTML.
//
// ?img=<b64url>&cap=<b64url> prefill the manual form — the monthly absence
// approval email links here with the signed shamecard URL + caption.

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Admin — postări',
  robots: { index: false, follow: false },
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')
const CANDIDATE_DAYS = 14

const STATUS_LINE: Record<string, string> = {
  promulgat: 'Promulgată — urmează publicarea în Monitorul Oficial.',
  retrimis: 'Retrimisă de Președinte în Parlament pentru reexaminare.',
  sesizat_ccr: 'Contestată la Curtea Constituțională.',
}

function b64urlDecode(s: string | undefined): string {
  if (!s) return ''
  try {
    return Buffer.from(s, 'base64url').toString('utf8')
  } catch {
    return ''
  }
}

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
    .select('id, code, title, summary, presidential_status, presidential_date, interest_score, interest_reason, initiator_type')
    .in('id', ids)
  const top = (laws ?? [])
    .sort((a, b) => (b.interest_score ?? -1) - (a.interest_score ?? -1))
    .slice(0, 8)
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
      carouselCaption: status ? lawCarouselCaption(status, { initiator, devCount }) : null,
    }
  })
}

const RO_MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']

function roDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${RO_MONTHS[m - 1]} ${y}`
}

const EVENT_LABEL: Record<string, string> = {
  promulgat: 'promulgată', retrimis: 'retrimisă de Președinte', sesizat_ccr: 'sesizare CCR',
}

/** The recent decisive event that put this law on the candidates list. */
function qualifyingEvent(l: Awaited<ReturnType<typeof fetchCandidates>>[number]): string {
  if (l.presidential_status && l.presidential_date) {
    return `${EVENT_LABEL[l.presidential_status] ?? l.presidential_status} · ${roDate(l.presidential_date)}`
  }
  if (l.lastVote) {
    const ch = l.lastVote.chamber === 'senate' ? 'Senat' : 'Cameră'
    return `vot final ${ch} (${l.lastVote.outcome ?? '—'}) · ${roDate(l.lastVote.vote_date)}`
  }
  return ''
}

function lawCaption(l: Awaited<ReturnType<typeof fetchCandidates>>[number]): string {
  const lines = [`📋 ${l.code} — pe scurt`, '']
  if (l.summary) lines.push(l.summary.length > 500 ? l.summary.slice(0, 497).trimEnd() + '…' : l.summary, '')
  if (l.presidential_status && STATUS_LINE[l.presidential_status]) {
    lines.push(STATUS_LINE[l.presidential_status], '')
  } else if (l.lastVote) {
    const ch = l.lastVote.chamber === 'senate' ? 'Senat' : 'Camera Deputaților'
    const oc = l.lastVote.outcome === 'respins' ? 'Respinsă' : 'Adoptată'
    lines.push(`${oc} în ${ch}: ${l.lastVote.for_count ?? 0} pentru, ${l.lastVote.against_count ?? 0} împotrivă.`, '')
  }
  lines.push(`Cum a votat fiecare parlamentar: ${SITE}/legi/${l.id} (link în bio)`, '',
             '#parlament #legi #laButoane #transparență #românia')
  return lines.join('\n')
}

async function fetchShameCaption(): Promise<string> {
  const db = getDB()
  const [{ data: sen }, { data: dep }] = await Promise.all([
    db.from('senator_stats').select('name, first_name, party_abbr, presence_pct')
      .eq('active', true).is('gov_role', null).order('presence_pct', { ascending: true }).limit(5),
    db.from('deputy_stats').select('name, first_name, party_abbr, presence_pct')
      .eq('active', true).is('gov_role', null).order('presence_pct', { ascending: true }).limit(5),
  ])
  const entries = [
    ...(sen ?? []).map(s => ({ ...s, chamber: 'Senat' })),
    ...(dep ?? []).map(s => ({ ...s, chamber: 'Cameră' })),
  ]
    .map(s => ({ pct: Math.round(100 - (s.presence_pct ?? 100)), name: `${s.first_name} ${s.name}`, party: s.party_abbr, chamber: s.chamber }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)
  return [
    '🔴 Absențe — top 5: cei mai absenți parlamentari', '',
    'Absențe la voturile din plen, de la începutul legislaturii (20 decembrie 2024):', '',
    ...entries.map((e, i) => `${i + 1}. ${e.name} (${e.party}, ${e.chamber}) — ${e.pct}% absențe`),
    '', 'Membrii Guvernului nu sunt incluși — ei nu votează în plen.',
    '', `Toată lista: ${SITE}`, '',
    '#parlament #absenteism #laButoane #transparență #românia',
  ].join('\n')
}

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ key?: string; img?: string; cap?: string }>
}) {
  const sp = await searchParams
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey || sp.key !== adminKey) notFound()

  const [candidates, shameCaption] = await Promise.all([fetchCandidates(), fetchShameCaption()])
  const prefillImg = b64urlDecode(sp.img)
  const prefillCap = b64urlDecode(sp.cap)

  return (
    <div className="max-w-[860px]">
      <h1 className="text-xl font-bold">Postări — alege și publică</h1>
      <p className="text-[13px] text-muted mt-1">
        Publicarea merge direct pe @vot.romania — butonul cere o a doua apăsare de confirmare.
        Previzualizările pot da 503 (limita CPU pe planul Free) — reîncarcă.
      </p>

      {(prefillImg || prefillCap) && (
        <section className="mt-8">
          <h2 className="text-[15px] font-bold text-respins">Din emailul de aprobare</h2>
          <div className="mt-3">
            <ManualPublish adminKey={adminKey} initialImages={prefillImg} initialCaption={prefillCap} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[15px] font-bold">Candidați — legi cu vot final / promulgare în ultimele {CANDIDATE_DAYS} zile</h2>
        <p className="text-[12px] text-faint mt-0.5">
          Sortate după scorul de interes. Se afișează tot caruselul (rezumat → camere → devieri);
          slide-urile cu hemiciclu se randează offline — cele marcate „nerandat" apar după
          comanda de randare + deploy. Carusel complet = publicabil dintr-o apăsare.
        </p>
        <div className="mt-4 flex flex-col gap-8">
          {candidates.length === 0 && <p className="text-[13px] text-faint">Nicio lege cu activitate decisivă recentă.</p>}
          {candidates.map((l, i) => (
            <div key={l.id} className="border border-rim rounded-xl p-4">
              <div className="flex items-baseline gap-2 flex-wrap mb-3">
                <span className="text-[13px] font-bold">{l.code}</span>
                {/* why it's on the list — old registration codes (L…/2021) are
                    normal: bills crawl for years, the EVENT is what's recent */}
                <span className="text-[11px] font-medium text-adoptat">
                  {qualifyingEvent(l)}
                </span>
                {l.interest_score != null && (
                  <span className="text-[11px] text-faint">interes {l.interest_score}/100{l.interest_reason ? ` — ${l.interest_reason}` : ''}</span>
                )}
              </div>
              <p className="text-[12.5px] text-muted mb-3">{l.title.length > 160 ? l.title.slice(0, 157) + '…' : l.title}</p>
              {l.slides.length > 0 ? (
                <CarouselPublishCard
                  adminKey={adminKey}
                  slides={l.slides.map(s => ({ url: `${SITE}${s.static}`, label: s.label }))}
                  fallbackImage={`${SITE}/api/og/${l.slides[0].suffix}`}
                  initialCaption={l.carouselCaption ?? lawCaption(l)}
                  command={`cd frontend && node scripts/render-ig.mjs ${l.id} && npm run deploy`}
                />
              ) : (
                <PublishCard
                  adminKey={adminKey}
                  image={`${SITE}/api/og/summarycard?id=${l.id}`}
                  initialCaption={lawCaption(l)}
                  stagger={i * 900}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-bold">Absențe — top 5 (tot mandatul)</h2>
        <p className="text-[12px] text-faint mt-0.5">Varianta lunară vine pe email pe 1 ale lunii, cu verificările de context.</p>
        <div className="mt-3 border border-rim rounded-xl p-4">
          <PublishCard adminKey={adminKey} image={`${SITE}/api/og/shamecard`} initialCaption={shameCaption} stagger={candidates.length * 900} />
        </div>
      </section>

      <section className="mt-10 mb-8">
        <h2 className="text-[15px] font-bold">Postare manuală</h2>
        <p className="text-[12px] text-faint mt-0.5">Orice URL de card de pe {SITE} — un URL pe linie, 2+ = carusel.</p>
        <div className="mt-3 border border-rim rounded-xl p-4">
          <ManualPublish adminKey={adminKey} />
        </div>
      </section>
    </div>
  )
}
