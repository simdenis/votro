// 1080×1080 launch carousel — the intro post that explains what VotRO is.
// Slides 1..4; same brand language as the data cards.

export interface IntroCardData {
  slide: number
  siteUrl: string // shown without protocol, e.g. "vot-romania.vercel.app"
}

const C = {
  bg: '#fafaf8',
  text: '#0a0a14',
  navy: '#0f2464',
  for: '#1a7a42',
  against: '#c4362e',
  hair: '#e6e5e1',
}
const SERIF = 'DM Serif Display'
const SANS = 'DM Sans'

function Frame({ children, kicker }: { children: React.ReactNode; kicker: string }) {
  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', height: 12 }}>
        <div style={{ flex: 1, background: '#002B7F' }} />
        <div style={{ flex: 1, background: '#FCD116' }} />
        <div style={{ flex: 1, background: '#CE1126' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '36px 64px 22px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 52, color: C.navy, letterSpacing: '-1.5px', lineHeight: 1 }}>VotRO</div>
        <div style={{ display: 'flex', fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', color: C.text, opacity: 0.55 }}>{kicker}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />
      {children}
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 26 }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.for} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 20, marginTop: 6, flexShrink: 0 }}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <div style={{ display: 'flex', fontSize: 33, lineHeight: 1.28, color: C.text }}>{children}</div>
    </div>
  )
}

export function IntroCard({ data }: { data: IntroCardData }) {

  // ── Slide 1 — cover ───────────────────────────────────────────
  if (data.slide === 1) {
    return (
      <Frame kicker="Parlamentul României">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 92, lineHeight: 1.02, color: C.text, letterSpacing: '-1px' }}>
            Cum votează Parlamentul
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: C.text, opacity: 0.7, marginTop: 30 }}>
            Fiecare vot, fiecare senator, fiecare deputat.
          </div>
        </div>
        <div style={{ display: 'flex', padding: '0 64px 56px' }}>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, color: C.navy }}>@vot.romania</div>
        </div>
      </Frame>
    )
  }

  // ── Slide 2 — the problem ─────────────────────────────────────
  if (data.slide === 2) {
    return (
      <Frame kicker="De ce">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 1.06, color: C.text }}>
            Datele sunt publice.
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 1.06, color: C.against, marginTop: 6 }}>
            Dar îngropate.
          </div>
          <div style={{ display: 'flex', fontSize: 32, lineHeight: 1.4, color: C.text, opacity: 0.72, marginTop: 40, maxWidth: 820 }}>
            Voturile Senatului și ale Camerei stau în PDF-uri și pagini web greu de citit. VotRO le adună, le curăță și le explică pe înțelesul tuturor.
          </div>
        </div>
        <div style={{ display: 'flex', padding: '0 64px 56px', fontSize: 18, color: C.text, opacity: 0.5 }}>sursă oficială: senat.ro · cdep.ro</div>
      </Frame>
    )
  }

  // ── Slide 3 — what you find ───────────────────────────────────
  if (data.slide === 3) {
    return (
      <Frame kicker="Ce găsești">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '48px 64px 0' }}>
          <div style={{ fontFamily: SERIF, fontSize: 54, lineHeight: 1.05, color: C.text, marginBottom: 44 }}>Ce găsești pe VotRO</div>
          <Bullet>Cum a votat fiecare senator și deputat.</Bullet>
          <Bullet>Absențele reale, de la validarea mandatului.</Bullet>
          <Bullet>Cine deviază de la linia de partid.</Bullet>
          <Bullet>Legile adoptate tacit, fără ca cineva să voteze.</Bullet>
          <Bullet>Traseiștii care au schimbat partidul.</Bullet>
          <Bullet>Rezumate pe scurt pentru fiecare lege.</Bullet>
        </div>
        <div style={{ display: 'flex', padding: '0 64px 48px', fontSize: 20, fontWeight: 600, color: C.navy }}>@vot.romania</div>
      </Frame>
    )
  }

  // ── Slide 4 — CTA ─────────────────────────────────────────────
  return (
    <Frame kicker="Independent">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 2, textTransform: 'uppercase', color: C.text, opacity: 0.55, marginBottom: 22 }}>
          Independent · Neafiliat · Gratuit
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 86, lineHeight: 1.04, color: C.text, letterSpacing: '-1px' }}>
          Vezi cum votează cei pe care i-ai ales.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 64px 56px' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: C.navy }}>@vot.romania</div>
        <div style={{ display: 'flex', fontSize: 22, color: C.text, opacity: 0.6, marginTop: 8 }}>Site-ul: link în bio.</div>
      </div>
    </Frame>
  )
}
