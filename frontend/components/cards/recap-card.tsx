import { categoryColor } from '@/lib/category-colors'
import { C, F, T, CardHeader, CardFooter, StatusChip, type Tone } from './kit'

// One law inside a multi-law carousel (weekly recap, «trecute de Parlament»).
// Every slide has the same four parts in the same place, so swiping reads as a
// list: which law (headline), what it does (summary), what happened THIS week
// (the event panel — the reason it is in this carousel), what comes next.
// The event panel replaces the law's overall status chip, which disagreed with
// the cover («7 adoptate» over a slide saying «ÎN DEZBATERE»).

export interface RecapCardData {
  /** kicker, e.g. «Săptămâna trecută» */
  kicker: string
  /** «3 / 8» — the slide's place in the carousel */
  position: string
  lawCode: string
  category: string | null
  headline: string | null
  lawTitle: string
  summary: string | null
  /** what happened this week: «Adoptat de Senat», «Promulgată», «Respins de Cameră» */
  event: { label: string; tone: Tone; tally?: string | null; date?: string | null }
  /** «Urmează Camera Deputaților.» / «A intrat în vigoare.» / null */
  nextLine?: string | null
  /** footer attribution — the summary's real source (see SummaryCard.sourceLine) */
  source?: string | null
}

function headlineSize(len: number): number {
  if (len <= 34) return 78
  if (len <= 56) return 66
  if (len <= 84) return 56
  return 48
}

function summarySize(len: number): number {
  if (len <= 160) return 38
  if (len <= 260) return 34
  return 30
}

export function RecapCard({ data }: { data: RecapCardData }) {
  const cat = categoryColor(data.category) ?? C.ink
  const headline = data.headline?.trim() || null
  const body = data.summary?.trim() || null

  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.ink, fontFamily: F.sans }}>
      <CardHeader kicker={data.kicker} right={data.position} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '40px 64px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
          <div style={{ display: 'flex', fontFamily: F.mono, fontSize: T.small, fontWeight: 500, letterSpacing: 2 }}>{data.lawCode}</div>
          {data.category ? <div style={{ display: 'flex', fontSize: T.small, fontWeight: 600, color: cat, textTransform: 'uppercase', letterSpacing: 2 }}>{data.category}</div> : null}
        </div>

        <div style={{ fontFamily: F.display, fontSize: headline ? headlineSize(headline.length) : 44, lineHeight: 1.08, color: C.ink, marginTop: 20, flexShrink: 0 }}>
          {headline ?? data.lawTitle}
        </div>

        <div style={{ display: 'flex', flexGrow: 1, minHeight: 36 }} />

        {body ? (
          <div style={{ display: 'flex', flexShrink: 0 }}>
            <div style={{ display: 'flex', width: 6, borderRadius: 3, background: cat, marginRight: 28, flexShrink: 0 }} />
            <div style={{ fontSize: summarySize(body.length), lineHeight: 1.38, color: C.slate }}>{body}</div>
          </div>
        ) : (
          <div style={{ fontSize: T.small, lineHeight: 1.4, color: C.muted, marginTop: 24 }}>{data.lawTitle}</div>
        )}

        <div style={{ display: 'flex', flexGrow: 1.4, minHeight: 32 }} />

        {/* what happened this week — the same panel, same place, on every slide */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, background: C.paper, borderRadius: 12, padding: '30px 34px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <StatusChip label={data.event.label} tone={data.event.tone} />
            {data.event.tally ? <div style={{ display: 'flex', fontFamily: F.display, fontSize: 40, color: C.ink }}>{data.event.tally}</div> : null}
            {data.event.date ? <div style={{ display: 'flex', fontSize: T.small, color: C.muted }}>{data.event.date}</div> : null}
          </div>
          {data.nextLine ? <div style={{ display: 'flex', fontSize: T.body, lineHeight: 1.3, color: C.ink }}>{data.nextLine}</div> : null}
        </div>
      </div>

      <CardFooter source={data.source ?? 'surse: senat.ro · cdep.ro'} />
    </div>
  )
}
