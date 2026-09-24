// 1080×1350 educational carousel — "0 voturi împotrivă. Și tot a picat."
// 1 cover (the L366/2026 arc) · 2 the arithmetic (104 present → threshold 53,
// only 44 for) drawn on a seat bar · 3 the paradox (the same 44 would have
// passed had 30 abstainers left the room: 74 present → threshold 38) · 4 the
// art. 76 rule · 5 the three Senate rejections of 21 Sep 2026 + CTA.
// v1 (a raw votecard as slide 2, no arithmetic) read as unclear — the
// threshold has to be SEEN. One-off content like intro/structura: official
// senat.ro tallies, frozen on purpose (the post is about that sitting).

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

/** A row of `present` seats: `forN` green then `abstainN` amber, with the
 *  majority threshold (floor(present/2)+1) drawn as a marker. Same pixel
 *  scale across slides (one seat = W/104) so the hypothetical bar on slide 3
 *  is visibly shorter than the real one. */
function SeatBar({ present, forN, abstainN, scaleSeats = 104 }: { present: number; forN: number; abstainN: number; scaleSeats?: number }) {
  const W = 952, H = 64
  const px = W / scaleSeats
  const threshold = Math.floor(present / 2) + 1
  const tx = Math.round(threshold * px * 100) / 100
  // HTML label, not SVG <text> (satori); the arrow glyph is not in the Plex subset either
  return (
    <div style={{ display: 'flex', position: 'relative', width: W, height: H + 44 }}>
      <div style={{ display: 'flex', position: 'absolute', left: tx - 60, top: 0, width: 120, justifyContent: 'center', fontFamily: MONO, fontSize: 16, fontWeight: 600, letterSpacing: 1.5, color: C.text }}>
        {`PRAG · ${threshold}`}
      </div>
      <svg width={W} height={H + 44} viewBox={`0 0 ${W} ${H + 44}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <rect x={0} y={44} width={Math.round(present * px)} height={H} rx={10} fill="#E7E9EC" />
        <rect x={0} y={44} width={Math.round(forN * px)} height={H} rx={10} fill={C.for} />
        <rect x={Math.round(forN * px)} y={44} width={Math.round(abstainN * px)} height={H} fill={C.amber} />
        <line x1={tx} y1={28} x2={tx} y2={44 + H + 8} stroke={C.text} strokeWidth={4} strokeDasharray="8 6" />
      </svg>
    </div>
  )
}

function Arrow() {
  return (
    <div style={{ display: 'flex', paddingBottom: 34 }}>
      <svg width="40" height="28" viewBox="0 0 40 28" fill="none" stroke={C.gray400} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 14h32" /><path d="m24 3 11 11-11 11" />
      </svg>
    </div>
  )
}

function Verdict({ ok }: { ok: boolean }) {
  return (
    <div style={{ display: 'flex', padding: '9px 18px', borderRadius: 6, background: ok ? '#1F7A51' : C.against, color: '#FFFFFF', fontFamily: MONO, fontSize: 16, fontWeight: 600, letterSpacing: 2.5 }}>
      {ok ? 'ADOPTATĂ' : 'RESPINSĂ'}
    </div>
  )
}

export function MajorityCard({ data }: { data: MajorityCardData }) {
  // ── Slide 1 — cover: the L366/2026 arc (44 for / 0 against / 60 abstain / 30 absent)
  if (data.slide === 1) {
    const dots = computeArcDots(44, 0, 60, 0, 30)
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 1/5">
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
            Nu e o eroare. E aritmetica din Constituție. Glisează.
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 2 — the arithmetic ───────────────────────────────────
  if (data.slide === 2) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 2/5">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 17, letterSpacing: 3, textTransform: 'uppercase', color: C.amberDark, marginBottom: 12 }}>
            Socoteala
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 60, lineHeight: 1.06, marginBottom: 18 }}>Pragul nu e „mai mulți pentru decât contra”.</div>
          <div style={{ display: 'flex', fontSize: 26, lineHeight: 1.45, color: C.gray500, marginBottom: 40, maxWidth: 920 }}>
            O lege ordinară trece cu majoritatea senatorilor prezenți. Se numără toți cei din sală, inclusiv cei care se abțin.
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40, marginBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: SERIF, fontSize: 84, lineHeight: 1, color: C.text }}>104</div>
              <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, letterSpacing: 2, color: C.gray500, marginTop: 8 }}>PREZENȚI</div>
            </div>
            <Arrow />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: SERIF, fontSize: 84, lineHeight: 1, color: C.text }}>53</div>
              <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, letterSpacing: 2, color: C.gray500, marginTop: 8 }}>VOTURI „PENTRU” NECESARE</div>
            </div>
            <Arrow />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: SERIF, fontSize: 84, lineHeight: 1, color: C.for }}>44</div>
              <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, letterSpacing: 2, color: C.gray500, marginTop: 8 }}>AU FOST</div>
            </div>
          </div>
          <div style={{ display: 'flex', marginTop: 28 }}>
            <SeatBar present={104} forN={44} abstainN={60} />
          </div>
          <div style={{ display: 'flex', gap: 26, fontFamily: MONO, fontSize: 14, letterSpacing: 1.5, marginTop: 4 }}>
            <div style={{ display: 'flex', color: C.for }}>44 PENTRU</div>
            <div style={{ display: 'flex', color: C.amberDark }}>60 ABȚINERI</div>
            <div style={{ display: 'flex', color: C.gray500 }}>0 CONTRA</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 44 }}>
            <Verdict ok={false} />
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: C.text }}>Au lipsit 9 voturi „pentru”. Cele 0 voturi „contra” nu contează.</div>
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 3 — the paradox: abstention vs absence ───────────────
  if (data.slide === 3) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 3/5">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 17, letterSpacing: 3, textTransform: 'uppercase', color: C.amberDark, marginBottom: 12 }}>
            Paradoxul abținerii
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 60, lineHeight: 1.06, marginBottom: 18 }}>Aceleași 44 de voturi ar fi trecut legea. Dacă 30 de abțineri deveneau absențe.</div>
          <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.45, color: C.gray500, marginBottom: 36, maxWidth: 920 }}>
            Abținerea se numără la prezență, deci ridică pragul. Absența nu. Practic, o abținere apasă legea mai tare decât o absență.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 6 }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: C.text }}>Ce s-a întâmplat</div>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, letterSpacing: 1.5, color: C.gray500 }}>104 PREZENȚI · 44 PENTRU · 60 ABȚINERI</div>
          </div>
          <SeatBar present={104} forN={44} abstainN={60} />
          <div style={{ display: 'flex', marginTop: 6 }}><Verdict ok={false} /></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 44, marginBottom: 6 }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: C.text }}>Dacă 30 dintre ei lipseau</div>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, letterSpacing: 1.5, color: C.gray500 }}>74 PREZENȚI · 44 PENTRU · 30 ABȚINERI</div>
          </div>
          <SeatBar present={74} forN={44} abstainN={30} />
          <div style={{ display: 'flex', marginTop: 6 }}><Verdict ok={true} /></div>
        </div>
      </Frame>
    )
  }

  // ── Slide 4 — the rule ─────────────────────────────────────────
  if (data.slide === 4) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 4/5">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 17, letterSpacing: 3, textTransform: 'uppercase', color: C.amberDark, marginBottom: 12 }}>
            Regula majorității
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 56, lineHeight: 1.06, marginBottom: 16 }}>Nu contează câți sunt împotrivă. Contează câți sunt pentru.</div>
          <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.45, color: C.gray500, marginBottom: 20, maxWidth: 920 }}>
            O lege trece doar dacă voturile „pentru” ating pragul cerut de Constituție:
          </div>
          <Row lead="Lege ordinară: majoritatea celor prezenți" rest="Jumătate din cei aflați în sală, plus unu. Luni: 53 din 104." />
          <Row lead="Lege organică: majoritatea tuturor senatorilor" rest="68 din 134, indiferent câți sunt prezenți la vot." />
          <Row lead="Contra sau abținere: același efect" rest="Niciuna nu adaugă la „pentru”, și amândouă se numără la prezență. Legea trece doar dacă „pentru” atinge pragul." />
          <div style={{ display: 'flex', marginTop: 34, background: C.raised, borderRadius: 12, padding: '24px 30px', fontSize: 23, lineHeight: 1.45, color: C.text }}>
            De aceea, pe LaButoane, rezultatul unui vot din Senat vine din fișa oficială a legii, nu din simpla comparație pentru/contra.
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 5 — the three rejections + CTA ───────────────────────
  return (
    <Frame kicker="CUM FUNCȚIONEAZĂ · 5/5">
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
