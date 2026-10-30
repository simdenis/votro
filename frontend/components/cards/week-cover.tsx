import { C, F, T, CardHeader, CardFooter, clip } from './kit'

// Cover of a multi-law carousel. v2 lists what is inside — every law's headline
// in slide order — so the post is understood from the cover alone and the
// count can't drift from the slides.

export interface WeekCoverItem { code: string; headline: string; presidential?: string | null }

// presedinte: the title says WHAT the President did, not a vague «a decis»
// (user, 30 Oct). One kind of decision → «Promulgate de Președinte»; a mix →
// «Ce a promulgat și ce a retrimis Președintele», a count per kind, and each
// row tagged. Mirrors president_header() in scraper/auto_post.py.
const PRES: Record<string, { verb: string; title: string; one: string; many: string }> = {
  promulgat: { verb: 'a promulgat', title: 'Promulgate de Președinte', one: 'promulgată', many: 'promulgate' },
  retrimis: { verb: 'a retrimis', title: 'Retrimise Parlamentului de Președinte', one: 'retrimisă', many: 'retrimise' },
  sesizat_ccr: { verb: 'a trimis la CCR', title: 'Trimise de Președinte la CCR', one: 'trimisă la CCR', many: 'trimise la CCR' },
}
const PRES_ORDER = ['promulgat', 'retrimis', 'sesizat_ccr']

export function presidentTitle(statuses: (string | null | undefined)[]): string {
  const kinds = PRES_ORDER.filter(k => statuses.includes(k))
  if (kinds.length === 0) return 'Decizii ale Președintelui'
  if (kinds.length === 1) return PRES[kinds[0]].title
  const verbs = kinds.map(k => `ce ${PRES[k].verb}`)
  const said = verbs.length === 2 ? verbs.join(' și ') : `${verbs.slice(0, -1).join(', ')} și ${verbs[verbs.length - 1]}`
  return `${said.charAt(0).toUpperCase()}${said.slice(1)} Președintele`
}

export interface WeekCoverCardData {
  kind: 'votate' | 'parlament' | 'promulgate' | 'presedinte' | 'respinse'
  /** «5–11 octombrie 2026» */
  range: string
  /** in slide order; the cover shows up to 9 */
  items: WeekCoverItem[]
  /** the count in the caption, when it is more than the laws shown (a law voted twice, >9 laws) */
  count?: number
}

const COPY = {
  votate: { kicker: 'Săptămâna trecută', title: 'Ce a votat Parlamentul', one: 'vot final adoptat', many: 'voturi finale adoptate' },
  parlament: { kicker: 'Săptămâna aceasta', title: 'Ce a trecut de Parlament', one: 'lege trimisă la promulgare', many: 'legi trimise la promulgare' },
  promulgate: { kicker: 'Săptămâna aceasta', title: 'Ce s-a făcut lege', one: 'lege promulgată', many: 'legi promulgate' },
  presedinte: { kicker: 'Cotroceni', title: 'Decizii ale Președintelui', one: 'lege', many: 'legi' },
  respinse: { kicker: 'Săptămâna aceasta', title: 'Respinse definitiv de Parlament', one: 'lege respinsă', many: 'legi respinse' },
}

export function WeekCoverCard({ data }: { data: WeekCoverCardData }) {
  const k = COPY[data.kind]
  const shown = data.items.slice(0, 9)
  const n = Math.max(data.count ?? 0, data.items.length)
  const more = n - shown.length
  const rowSize = shown.length > 7 ? 28 : 32
  const pres = data.kind === 'presedinte'
  const statuses = data.items.map(it => it.presidential)
  const kinds = PRES_ORDER.filter(st => statuses.includes(st))
  const mixed = pres && kinds.length > 1
  const title = pres ? presidentTitle(statuses) : k.title
  // «3 promulgate · 1 retrimisă» for a mix; one kind keeps the big number
  const tally = kinds.map(st => {
    const c = statuses.filter(x => x === st).length
    return `${c} ${c === 1 ? PRES[st].one : PRES[st].many}`
  }).join(' · ')

  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.ink, fontFamily: F.sans }}>
      <CardHeader kicker={k.kicker} right={data.range} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '44px 64px 34px' }}>
        <div style={{ fontFamily: F.display, fontSize: mixed ? 64 : 76, lineHeight: 1.04, flexShrink: 0 }}>{title}</div>
        {mixed ? (
          <div style={{ display: 'flex', marginTop: 22, flexShrink: 0, fontSize: T.lead, color: C.slate }}>{tally}</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 18, flexShrink: 0 }}>
            <div style={{ display: 'flex', fontFamily: F.display, fontSize: 76, lineHeight: 1, color: data.kind === 'respinse' || (pres && kinds[0] !== 'promulgat') ? C.againstDark : C.forDark }}>{`${n}`}</div>
            <div style={{ display: 'flex', fontSize: T.lead, color: C.slate }}>{pres && kinds.length === 1 ? `${n === 1 ? 'lege' : 'legi'} ${n === 1 ? PRES[kinds[0]].one : PRES[kinds[0]].many}` : n === 1 ? k.one : k.many}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, flexShrink: 0 }}>
          {shown.map((it, i) => (
            <div key={it.code} style={{ display: 'flex', alignItems: 'baseline', gap: 22, padding: '14px 0', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
              {/* the slide this law is on — the cover is slide 1 */}
              <div style={{ display: 'flex', width: 40, flexShrink: 0, fontFamily: F.mono, fontSize: T.small, color: C.muted }}>{`${i + 2}`}</div>
              <div style={{ display: 'flex', flex: 1, fontSize: rowSize, lineHeight: 1.25, color: C.ink }}>{clip(it.headline, mixed ? (shown.length > 5 ? 46 : 90) : 58)}</div>
              {mixed && it.presidential && PRES[it.presidential] ? (
                <div style={{ display: 'flex', flexShrink: 0, fontFamily: F.mono, fontSize: T.small, color: it.presidential === 'promulgat' ? C.forDark : C.againstDark }}>{PRES[it.presidential].one}</div>
              ) : null}
            </div>
          ))}
          {more > 0 ? (
            <div style={{ display: 'flex', padding: '14px 0 0 62px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, fontSize: rowSize, color: C.muted }}>
              {`și încă ${more} în descriere`}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexGrow: 1, minHeight: 20 }} />

      </div>

      <CardFooter />
    </div>
  )
}
