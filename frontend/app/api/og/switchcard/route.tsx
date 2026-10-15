import { ImageResponse } from 'next/og'
import { getSwitchers } from '@/lib/switchers'
import { getCardFonts } from '@/lib/og-fonts'
import { textOnColor } from '@/lib/utils'
import { CardHeader, CardFooter } from '@/components/cards/kit'

// 1080×1350 "traseiști" card — genuine party switchers (lib/switchers rules)
// whose latest switch happened in ?month=YYYY-MM (default: current month).
// Light render, data derived server-side from real history — nothing to spoof.

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                   'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

const C = { bg: '#FFFFFF', text: '#171A1F', accent: '#4E86D8', hair: '#E7E9EC', faint: '#6E7480' }
const SERIF = 'Plex Display'
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

function Pill({ abbr, color }: { abbr: string; color: string | null }) {
  const bg = color ?? '#9e9e9e'
  return (
    <div style={{
      display: 'flex', background: bg, color: textOnColor(bg), fontSize: 24, fontWeight: 700,
      padding: '4px 12px', borderRadius: 8, textTransform: 'uppercase',
    }}>{abbr}</div>
  )
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const all = sp.get('all') === '1'  // cumulative "since the elections", not one month
  const monthParam = sp.get('month')
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? '') ? monthParam! : new Date().toISOString().slice(0, 7)
  const [y, m] = month.split('-').map(Number)

  const everyone = await getSwitchers()
  const total = everyone.length
  const senateCount = everyone.filter(s => s.chamber === 'senate').length
  const chamberNoun = senateCount === 0 ? 'deputați' : 'parlamentari'

  // all-mode paginates (8/slide) so a carousel can cover everyone; sorted by
  // number of hops so the juiciest journeys lead.
  const PER = 8
  const page = Math.max(0, parseInt(sp.get('page') ?? '0', 10) || 0)
  const pages = Math.max(1, Math.ceil(total / PER))
  const from0 = page * PER
  const switchers = all
    ? [...everyone].sort((a, b) => b.segments.length - a.segments.length).slice(from0, from0 + PER)
    : everyone.filter(s => {
        const last = s.segments[s.segments.length - 1]
        return last && (last.from_date ?? '').startsWith(month)
      }).slice(0, 8)
  const isLastPage = page >= pages - 1

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350 }}>
        <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
          <CardHeader kicker={all ? 'Legislatura 2024–2028' : `${RO_MONTHS[m - 1]} ${y}`} />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '20px 64px' }}>
            <div style={{ fontFamily: SERIF, fontSize: 58, lineHeight: 1.05, color: C.accent }}>
              {all ? `${total} ${chamberNoun} și-au schimbat partidul` : 'Cine a schimbat partidul'}
            </div>
            <div style={{ display: 'flex', fontSize: 24, opacity: 0.55, marginTop: 10, marginBottom: 34 }}>
              {all
                ? (pages > 1 ? `de la alegeri · ${from0 + 1}–${from0 + switchers.length} din ${total} (origine → partid actual)` : 'de la alegeri, în această legislatură (origine → partid actual)')
                : `parlamentari care au trecut la alt partid în ${RO_MONTHS[m - 1]} ${y}`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {switchers.length === 0 && (
                <div style={{ display: 'flex', fontSize: 26, opacity: 0.6 }}>Niciun traseist luna aceasta.</div>
              )}
              {switchers.map((s, i) => {
                // all-time: show the full journey endpoints (origin → current);
                // monthly: show just the latest hop
                const from = all ? s.segments[0] : s.segments[s.segments.length - 2]
                const to = s.segments[s.segments.length - 1]
                return (
                  <div key={s.politician_id} style={{
                    display: 'flex', alignItems: 'center', padding: '20px 0',
                    ...(i < switchers.length - 1 ? { borderBottom: `1px solid ${C.hair}` } : {}),
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>{`${s.first_name} ${s.name}`}</div>
                      <div style={{ display: 'flex', fontSize: 22, opacity: 0.5, marginTop: 2 }}>
                        {s.chamber === 'senate' ? 'SENAT' : 'CAMERĂ'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {from && <Pill abbr={from.abbreviation} color={from.color} />}
                      {/* inline SVG arrow — "→" is not in the Plex subset */}
                      <svg width="26" height="16" viewBox="0 0 26 16"><path d="M0 8h22M16 2l7 6-7 6" stroke="#6E7480" strokeWidth="2.2" fill="none" /></svg>
                      {to && <Pill abbr={to.abbreviation} color={to.color} />}
                    </div>
                  </div>
                )
              })}
            </div>

            {all && (
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: C.accent, marginTop: 18 }}>
                {isLastPage ? 'Parcursul fiecăruia pe la-butoane.ro/traseisti' : `…continuă (${total - (from0 + switchers.length)} rămași)`}
              </div>
            )}

            <div style={{ display: 'flex', fontSize: 24, opacity: 0.7, marginTop: 30 }}>
              Doar schimbări confirmate de listele oficiale de membri, nu grupări de o zi din erori de vot.
            </div>
          </div>

          <CardFooter source={"surse: senat.ro · cdep.ro"} />
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts },
  )
}
