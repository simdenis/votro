// 1080×1350 educational carousel — "0 voturi împotrivă. Și tot a picat."
// Slide 1 cover (the L366/2026 arc), slide 2 the majority rule (art. 76),
// slide 3 the three Senate rejections of 21 Sep 2026 + CTA. Slide 2 of the
// published deck is the live /api/og/votecard for L366, not rendered here.
// One-off content like intro/structura: the numbers are the official tallies
// from senat.ro, frozen on purpose (the post is about that sitting).

import { computeArcDots } from './vote-card'

export interface MajorityCardData { slide: number }

const C = {
  bg: '#FFFFFF', text: '#171A1F', for: '#2EA871', against: '#EE7B5E',
  amber: '#E3A23C', amberDark: '#B27A24', hair: '#E7E9EC',
  gray500: '#6E7480', gray400: '#9AA0AA', raised: '#F5F6F8',
}
const SERIF = 'Plex Display'
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

function Frame({ children, kicker }: { children: React.ReactNode; kicker: string }) {
  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '36px 64px 22px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: C.gray500 }}>{kicker}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />
      {children}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: '#6E7480' }}>Constituția României, art. 76 · sursă: senat.ro</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 26, letterSpacing: '-0.015em', color: '#171A1F' }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ lead, rest }: { lead: string; rest: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 0', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: C.hair }}>
      <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, color: C.text }}>{lead}</div>
      <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.45, color: C.gray500 }}>{rest}</div>
    </div>
  )
}

function Tally({ f, a, ab }: { f: number; a: number; ab: number }) {
  const cell = (n: number, label: string, color: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 30, color }}>{String(n)}</div>
      <div style={{ display: 'flex', fontFamily: MONO, fontSize: 13, letterSpacing: 1.5, color: C.gray500 }}>{label}</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', gap: 28, marginTop: 6 }}>
      {cell(f, 'PENTRU', C.for)}{cell(a, 'CONTRA', C.against)}{cell(ab, 'ABȚINERI', C.amberDark)}
    </div>
  )
}

export function MajorityCard({ data }: { data: MajorityCardData }) {
  // ── Slide 1 — cover: the L366/2026 arc (44 for / 0 against / 60 abstain / 30 absent)
  if (data.slide === 1) {
    const dots = computeArcDots(44, 0, 60, 0, 30)
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 1/4">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 84, lineHeight: 1.05, letterSpacing: '-1px', color: C.text }}>
            0 voturi împotrivă. Și tot a picat.
          </div>
          <div style={{ display: 'flex', fontSize: 29, lineHeight: 1.45, color: C.gray500, marginTop: 28, maxWidth: 900 }}>
            Luni, în Senat: 44 de senatori pentru, niciunul contra, 60 de abțineri. Legea culoarului de salvare a fost respinsă.
          </div>
          <div style={{ display: 'flex', width: '100%', height: 220, justifyContent: 'center', marginTop: 40 }}>
            <svg width={680} height={220} viewBox="0 0 952 308">
              {dots.map((d, i) => <circle key={i} cx={Math.round(d.x * 100) / 100} cy={Math.round(d.y * 100) / 100} r={7} fill={d.color} />)}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 26, fontFamily: MONO, fontSize: 14, letterSpacing: 1.5, marginTop: 6 }}>
            <div style={{ display: 'flex', color: C.for }}>44 PENTRU</div>
            <div style={{ display: 'flex', color: C.against }}>0 CONTRA</div>
            <div style={{ display: 'flex', color: C.amberDark }}>60 ABȚINERI</div>
            <div style={{ display: 'flex', color: C.gray400 }}>30 ABSENȚI</div>
          </div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: C.amberDark, marginTop: 44 }}>
            Cum se poate? Glisează.
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 3 of the deck — the rule ─────────────────────────────
  if (data.slide === 2) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 3/4">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 17, letterSpacing: 3, textTransform: 'uppercase', color: C.amberDark, marginBottom: 12 }}>
            Regula majorității
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 56, lineHeight: 1.06, marginBottom: 16 }}>Nu contează câți sunt împotrivă. Contează câți sunt pentru.</div>
          <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.45, color: C.gray500, marginBottom: 20, maxWidth: 920 }}>
            O lege trece doar dacă voturile „pentru” ating pragul cerut de Constituție:
          </div>
          <Row lead="Lege ordinară: majoritatea celor prezenți" rest="Luni erau 104 senatori în sală, deci pragul era 53 de voturi „pentru”. Au fost 44." />
          <Row lead="Lege organică: majoritatea tuturor senatorilor" rest="68 din 134, indiferent câți sunt prezenți la vot." />
          <Row lead="Abținerea nu e neutră" rest="Senatorul care se abține e prezent, deci ridică pragul, dar nu adaugă nimic la „pentru”. În practică, cântărește ca un vot contra." />
          <div style={{ display: 'flex', marginTop: 34, background: C.raised, borderRadius: 12, padding: '24px 30px', fontSize: 23, lineHeight: 1.45, color: C.text }}>
            De aceea, pe LaButoane, rezultatul unui vot din Senat vine din fișa oficială a legii, nu din simpla comparație pentru/contra.
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 4 of the deck — the three rejections + CTA ───────────
  return (
    <Frame kicker="CUM FUNCȚIONEAZĂ · 4/4">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 17, letterSpacing: 3, textTransform: 'uppercase', color: C.amberDark, marginBottom: 12 }}>
          Senat · 21 septembrie 2026
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 56, lineHeight: 1.06, marginBottom: 24 }}>Trei legi respinse fără majoritate, în aceeași zi.</div>
        {[
          { code: 'L366/2026', t: 'Culoarul de salvare devine obligatoriu în trafic.', f: 44, a: 0, ab: 60 },
          { code: 'L402/2026', t: '500 de lei pe an pentru copiii cu dizabilități.', f: 33, a: 14, ab: 60 },
          { code: 'L421/2026', t: 'Clădirile publice, mai accesibile pentru toți.', f: 47, a: 11, ab: 47 },
        ].map(r => (
          <div key={r.code} style={{ display: 'flex', flexDirection: 'column', padding: '20px 0', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: C.hair }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, letterSpacing: 1.5, color: C.gray500 }}>{r.code}</div>
              <div style={{ display: 'flex', fontSize: 27, fontWeight: 600, color: C.text }}>{r.t}</div>
            </div>
            <Tally f={r.f} a={r.a} ab={r.ab} />
          </div>
        ))}
        <div style={{ display: 'flex', marginTop: 34, background: C.raised, borderRadius: 12, padding: '24px 30px', fontSize: 23, lineHeight: 1.45, color: C.text }}>
          Toate trei erau la prima cameră. Un vot negativ aici nu le îngroapă: merg mai departe la Camera Deputaților, care decide.
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: C.gray500, marginTop: 28 }}>
          Votul fiecărui senator, pe site: link în bio.
        </div>
      </div>
    </Frame>
  )
}
