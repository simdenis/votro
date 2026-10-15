import { ImageResponse } from 'next/og'
import { RecapCard, type RecapCardData } from '@/components/cards/recap-card'
import { getCardFonts } from '@/lib/og-fonts'
import { isUuid, plainSummary, capFirst } from '@/lib/utils'
import { withEdgeCache } from '@/lib/og-edge-cache'
import { nextAfterVote, nextAfterParliament } from '@/lib/next-step'
import type { Tone } from '@/components/cards/kit'

// One law inside a multi-law carousel (1080×1350):
//   /api/og/recapcard?id=<law>&kind=votate&pos=3/8&ch=senate&out=adoptat&t=46-18&d=2026-10-05
//   /api/og/recapcard?id=<law>&kind=parlament&pos=3/8
// kind=votate: the event is the week's final vote (passed by auto_post, which
// already picked it); kind=parlament: the event is where the law stands with
// the President. Text = the final-text explainer when there is one.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }
const get = (path: string) => fetch(`${U}/rest/v1/${path}`, { headers: SB }).then(r => r.json()).catch(() => null)
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']
const shortDate = (iso: string | null) => {
  const m = iso && /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : null
}

async function render(request: Request): Promise<Response> {
  const sp = new URL(request.url).searchParams
  const id = isUuid(sp.get('id')) ? sp.get('id')! : null
  if (!id) return new Response('law id required', { status: 400 })
  const kind = sp.get('kind') === 'parlament' ? 'parlament' : 'votate'
  const pos = (sp.get('pos') ?? '').replace(/[^0-9/]/g, '').replace('/', ' / ')

  const [lawRows, statusRows] = await Promise.all([
    get(`laws?id=eq.${id}&select=code,title,law_category,headline,summary,summary_source,explainer,presidential_status,presidential_date&limit=1`),
    get(`law_status?law_id=eq.${id}&select=presidential_status,senate_outcome,camera_outcome&limit=1`),
  ])
  const law = lawRows?.[0]
  if (!law) return new Response('Not found', { status: 404 })
  const ex = law.explainer as { titlu?: string; rezumat?: string; de_cand?: string | null } | null

  let event: RecapCardData['event']
  let next: string | null
  if (kind === 'votate') {
    const ch = sp.get('ch') === 'senate' ? 'senate' : 'deputies'
    const out = sp.get('out') === 'respins' ? 'respins' : 'adoptat'
    const where = ch === 'senate' ? 'Senat' : 'Cameră'
    event = {
      label: `${out === 'adoptat' ? 'Adoptat' : 'Respins'} de ${where}`,
      tone: (out === 'adoptat' ? 'for' : 'against') as Tone,
      tally: (sp.get('t') ?? '').replace(/[^0-9]+/g, '–').replace(/^–|–$/g, '') || null,
      date: shortDate(sp.get('d')),
    }
    next = nextAfterVote({ chamber: ch, outcome: out }, statusRows?.[0] ?? null, law.code)
  } else {
    const ps = law.presidential_status as string | null
    event = ps === 'promulgat' ? { label: 'Promulgată', tone: 'for', date: shortDate(law.presidential_date) }
      : ps === 'retrimis' ? { label: 'Retrimisă', tone: 'against', date: shortDate(law.presidential_date) }
      : ps === 'sesizat_ccr' ? { label: 'La CCR', tone: 'neutral', date: shortDate(law.presidential_date) }
      : { label: 'La Președinte', tone: 'neutral' }
    next = nextAfterParliament(ps, ex?.de_cand)
  }

  const summary = ex?.rezumat?.trim() || (law.summary ? plainSummary(law.summary) : null)
  const data: RecapCardData = {
    kicker: kind === 'votate' ? 'Săptămâna trecută' : 'Trecute de Parlament',
    position: pos,
    lawCode: String(law.code).replace(/^([A-Z]+)/, '$1 '),
    category: law.law_category,
    headline: ex?.titlu ?? law.headline ?? null,
    lawTitle: capFirst(law.title),
    summary,
    event,
    nextLine: next,
    source: ex?.rezumat ? 'rezumat AI · sursă: textul final al legii'
      : law.summary ? (law.summary_source === 'title' ? 'rezumat AI pe baza titlului oficial' : 'rezumat AI · sursă: proiectul inițial')
      : 'surse: senat.ro · cdep.ro',
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350 }}>
        <RecapCard data={data} />
      </div>
    ),
    { width: 1080, height: 1350, fonts },
  )
}

export async function GET(request: Request) {
  return withEdgeCache(request, () => render(request))
}
