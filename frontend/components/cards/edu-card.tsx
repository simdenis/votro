// 1080×1080 educational carousel — "cum devine un proiect lege" (post #2).
// Slides 1-6: cover, the four stages of the process (with a progress strip
// showing where you are), and the tacit-adoption exception as the closer.
// Amber = the brand's tacit hue; colors stay functional.

import { computeArcDots } from './vote-card'

export interface EduCardData {
  slide: number
  /** live count of bills with a running tacit term (slide 6) */
  pendingCount?: number
}

const C = {
  bg: '#FFFFFF',
  text: '#171A1F',
  for: '#2EA871',
  against: '#EE7B5E',
  amber: '#E3A23C',
  amberDark: '#B27A24',
  info: '#4E86D8',
  hair: '#E7E9EC',
  gray500: '#6E7480',
  gray400: '#9AA0AA',
  raised: '#F5F6F8',
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

const STAGES = ['Inițiativa', 'Prima cameră', 'Camera decizională', 'Președintele']

function Frame({ children, kicker }: { children: React.ReactNode; kicker: string }) {
  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      {/* no logo header on IG post slides — the profile picture already shows it */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '36px 64px 22px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: C.gray500 }}>{kicker}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />
      {children}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: C.gray500 }}>Constituția României, art. 74-77</div>
      </div>
    </div>
  )
}

/** Where we are in the process: 4 pills, the active stage filled ink. */
function ProgressStrip({ active }: { active: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 52 }}>
      {STAGES.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, flexGrow: i === active ? 0 : 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999,
            background: i === active ? C.text : C.raised,
            color: i === active ? '#FFFFFF' : C.gray500,
            fontSize: 17, fontWeight: i === active ? 600 : 500,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 14 }}>{String(i + 1)}</span>
            <span>{s}</span>
          </div>
          {i < 3 && (
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke={C.gray400} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 6h11" /><path d="m8 1 5 5-5 5" />
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}

/** One fact row: bold lead + plain rest. */
function Row({ lead, rest }: { lead: string; rest: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 0', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: C.hair }}>
      <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, color: C.text }}>{lead}</div>
      <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.45, color: C.gray500 }}>{rest}</div>
    </div>
  )
}

function StepSlide({ n, title, intro, rows, note }: {
  n: number; title: string; intro: string
  rows: { lead: string; rest: string }[]
  note?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
      <ProgressStrip active={n - 1} />
      <div style={{ display: 'flex', fontFamily: MONO, fontSize: 17, letterSpacing: 3, textTransform: 'uppercase', color: C.amberDark, marginBottom: 12 }}>
        {`Pasul ${n} din 4`}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 58, lineHeight: 1.06, marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.45, color: C.gray500, marginBottom: 26, maxWidth: 920 }}>{intro}</div>
      {rows.map(r => <Row key={r.lead} lead={r.lead} rest={r.rest} />)}
      {note && (
        <div style={{ display: 'flex', marginTop: 34, background: C.raised, borderRadius: 12, padding: '24px 30px', fontSize: 23, lineHeight: 1.45, color: C.text }}>
          {note}
        </div>
      )}
    </div>
  )
}

export function EduCard({ data }: { data: EduCardData }) {
  // ── Slide 1 — cover ───────────────────────────────────────────
  if (data.slide === 1) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 1/6">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 88, lineHeight: 1.05, letterSpacing: '-1px', color: C.text }}>
            Cum devine un proiect lege?
          </div>
          <div style={{ display: 'flex', fontSize: 30, lineHeight: 1.45, color: C.gray500, marginTop: 30, maxWidth: 880 }}>
            Tot drumul, pas cu pas: de la idee până în Monitorul Oficial.
          </div>
          <div style={{ display: 'flex', marginTop: 64 }}>
            <ProgressStrip active={-1} />
          </div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: C.amberDark, marginTop: 0 }}>
            Plus: cum trece o lege fără niciun vot.
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 2 — pasul 1: inițiativa ─────────────────────────────
  if (data.slide === 2) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 2/6">
        <StepSlide
          n={1}
          title="Inițiativa"
          intro="O lege începe cu un text depus în Parlament. Îl pot depune:"
          rows={[
            { lead: 'Guvernul', rest: 'proiecte de lege (cele mai multe dintre legile adoptate)' },
            { lead: 'Senatorii și deputații', rest: 'propuneri legislative, individual sau în grup' },
            { lead: 'Cetățenii', rest: '100.000 de semnături, din cel puțin un sfert din județe' },
          ]}
        />
      </Frame>
    )
  }

  // ── Slide 3 — pasul 2: prima cameră ───────────────────────────
  if (data.slide === 3) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 3/6">
        <StepSlide
          n={2}
          title="Prima cameră"
          intro="Textul intră întâi într-una dintre camere, stabilită de Constituție după subiectul legii."
          rows={[
            { lead: 'Comisiile îl analizează', rest: 'raport cu amendamente: adoptare sau respingere' },
            { lead: 'Plenul votează', rest: 'proiectul merge mai departe indiferent de rezultat' },
            { lead: '45 sau 60 de zile', rest: 'termenul în care prima cameră trebuie să se pronunțe' },
          ]}
        />
      </Frame>
    )
  }

  // ── Slide 4 — pasul 3: camera decizională ─────────────────────
  if (data.slide === 4) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 4/6">
        <StepSlide
          n={3}
          title="Camera decizională"
          intro="Cealaltă cameră reia procesul: comisii, dezbatere, vot în plen."
          rows={[
            { lead: 'Votul ei decide', rest: 'adoptat aici = adoptat de Parlament; respins aici = respins definitiv' },
            { lead: 'Fără termen', rest: 'poate ține un proiect în dezbatere oricât; nimic nu trece automat' },
          ]}
          note="De aceea, pe LaButoane, votul camerei decizionale e cel pe care îl vezi primul la fiecare lege."
        />
      </Frame>
    )
  }

  // ── Slide 5 — pasul 4: președintele ───────────────────────────
  if (data.slide === 5) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 5/6">
        <StepSlide
          n={4}
          title="Președintele"
          intro="Legea adoptată de Parlament ajunge la Cotroceni. Președintele are 20 de zile și trei opțiuni:"
          rows={[
            { lead: 'Promulgă', rest: 'legea apare în Monitorul Oficial și intră în vigoare' },
            { lead: 'Retrimite la Parlament', rest: 'o singură dată, pentru reexaminare; apoi trebuie să promulge' },
            { lead: 'Sesizează CCR', rest: 'dacă are îndoieli că legea respectă Constituția' },
          ]}
        />
      </Frame>
    )
  }

  // ── Slide 6 — excepția: adoptarea tacită ──────────────────────
  const dots = computeArcDots(0, 0, 0, 0, 134)
  return (
    <Frame kicker="CUM FUNCȚIONEAZĂ · 6/6">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 17, letterSpacing: 3, textTransform: 'uppercase', color: C.amberDark, marginBottom: 12 }}>
          Excepția de la pasul 2
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 58, lineHeight: 1.06, marginBottom: 16 }}>Adoptarea tacită</div>
        <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.5, color: C.gray500, maxWidth: 920 }}>
          Dacă termenul de 45 sau 60 de zile expiră fără vot, proiectul e considerat adoptat de prima cameră și merge mai departe. Automat, fără nicio dezbatere.
        </div>

        {/* the vote that never happened */}
        <div style={{ display: 'flex', width: '100%', height: 195, justifyContent: 'center', marginTop: 26 }}>
          <svg width={603} height={195} viewBox="0 0 952 308">
            {dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={4.5} fill="#D8DBE0" />
            ))}
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', fontFamily: MONO, fontSize: 14, letterSpacing: 1.5, color: C.gray500, marginTop: 2 }}>
          0 VOTURI · TRECE ORICUM
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 40 }}>
          <div style={{ fontFamily: SERIF, fontSize: 64, lineHeight: 1, color: C.amberDark }}>
            {String(data.pendingCount ?? '—')}
          </div>
          <div style={{ display: 'flex', fontSize: 27, fontWeight: 600, color: C.text }}>
            de proiecte au termenul în curs chiar acum
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: C.gray500, marginTop: 12 }}>
          Le urmărim pe toate, cu termenele lor oficiale. Site-ul: link în bio.
        </div>
      </div>
    </Frame>
  )
}
