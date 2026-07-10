// 1080×1080 educational carousel — "cum funcționează Parlamentul" (post #2).
// Slides 1-4; slide order in the post interleaves the real tacit-card example.
// Amber = the brand's tacit hue; colors stay functional.

export interface EduCardData {
  slide: number
  /** live count of bills with a running tacit term (slide 4) */
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
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

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
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: C.gray500 }}>Constituția României, art. 75</div>
      </div>
    </div>
  )
}

/** One step of the law's journey, with the annotation under it. */
function Step({ label, note, color, last }: { label: string; note: string; color: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', flexGrow: last ? 0 : 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 240 }}>
        <div style={{ display: 'flex', background: color, color: '#FFFFFF', fontSize: 19, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', height: 84, padding: '0 14px', borderRadius: 6, justifyContent: 'center', alignItems: 'center', textAlign: 'center', lineHeight: 1.25 }}>
          {label}
        </div>
        <div style={{ display: 'flex', fontSize: 18, lineHeight: 1.35, color: C.gray500, justifyContent: 'center', textAlign: 'center' }}>{note}</div>
      </div>
      {!last && (
        <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', height: 84, justifyContent: 'center' }}>
          <svg width="34" height="16" viewBox="0 0 34 16" fill="none" stroke={C.gray400} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8h26" /><path d="m24 2 6 6-6 6" />
          </svg>
        </div>
      )}
    </div>
  )
}

export function EduCard({ data }: { data: EduCardData }) {
  // ── Slide 1 — hook ────────────────────────────────────────────
  if (data.slide === 1) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 1/5">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 84, lineHeight: 1.05, letterSpacing: '-1px', color: C.text }}>
            O lege poate trece fără niciun vot.
          </div>
          <div style={{ display: 'flex', fontSize: 33, lineHeight: 1.4, color: C.amberDark, marginTop: 30, fontWeight: 600 }}>
            Legal. Se numește adoptare tacită.
          </div>
          <div style={{ display: 'flex', fontSize: 26, lineHeight: 1.45, color: C.gray500, marginTop: 16 }}>
            Uite cum funcționează, în 5 slide-uri.
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 2 — drumul unei legi ────────────────────────────────
  if (data.slide === 2) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 2/5">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 60, lineHeight: 1.08, marginBottom: 20 }}>Drumul unei legi</div>
          <div style={{ display: 'flex', fontSize: 26, lineHeight: 1.45, color: C.gray500, marginBottom: 64, maxWidth: 900 }}>
            Orice proiect trece prin ambele camere ale Parlamentului, apoi ajunge la Președinte.
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <Step label="Prima cameră" note="are 45 sau 60 de zile să voteze" color={C.info} />
            <Step label="Camera decizională" note="votul ei e cel care contează" color={C.text} />
            <Step label="Președinte" note="promulgă, retrimite sau sesizează CCR" color={C.for} last />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 80, background: '#F5F6F8', borderRadius: 12, padding: '30px 34px' }}>
            <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.45, color: C.text }}>
              Care e „prima cameră" depinde de subiectul legii: uneori Senatul, alteori Camera Deputaților.
            </div>
            <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.45, color: C.gray500 }}>
              Cealaltă devine automat camera decizională, cu votul final.
            </div>
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 3 — termenul tacit ──────────────────────────────────
  if (data.slide === 3) {
    return (
      <Frame kicker="CUM FUNCȚIONEAZĂ · 3/5">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 54, lineHeight: 1.08, marginBottom: 18 }}>Termenul tacit</div>
          <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.5, color: C.gray500, marginBottom: 44, maxWidth: 920 }}>
            Constituția dă primei camere un termen ca să se pronunțe. Dacă termenul expiră fără vot, legea e considerată adoptată automat.
          </div>

          {([
            ['45 de zile', 'pentru legile obișnuite'],
            ['60 de zile', 'pentru coduri și legi complexe'],
            ['0 voturi', 'necesare când termenul expiră'],
          ] as const).map(([big, small]) => (
            <div key={big} style={{ display: 'flex', alignItems: 'baseline', gap: 22, padding: '18px 0', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: C.hair }}>
              <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 52, color: C.amberDark, width: 300 }}>{big}</div>
              <div style={{ display: 'flex', fontSize: 25, color: C.text }}>{small}</div>
            </div>
          ))}

          <div style={{ display: 'flex', marginTop: 44, background: '#F5F6F8', borderRadius: 12, padding: '26px 30px', fontSize: 22, lineHeight: 1.5, color: C.text }}>
            Important: termenul există doar pentru prima cameră. Camera decizională nu are termen și trebuie să voteze mereu explicit.
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 4 — stat live + CTA ─────────────────────────────────
  return (
    <Frame kicker="CUM FUNCȚIONEAZĂ · 5/5">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <div style={{ fontFamily: SERIF, fontSize: 150, lineHeight: 1, color: C.amberDark }}>
            {String(data.pendingCount ?? '—')}
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: C.text, fontWeight: 600 }}>
            {`de proiecte au termenul în curs`}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 27, lineHeight: 1.5, color: C.gray500, marginTop: 26, maxWidth: 900 }}>
          Chiar acum, la Camera Deputaților. Oricare dintre ele poate deveni lege fără să apese nimeni un buton.
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: C.text, marginTop: 44, fontWeight: 600 }}>
          Le urmărim pe toate, cu termenele lor oficiale.
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: C.gray500, marginTop: 10 }}>
          Site-ul: link în bio.
        </div>
      </div>
    </Frame>
  )
}
