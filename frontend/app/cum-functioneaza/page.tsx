import Link from 'next/link'
import type { Metadata } from 'next'
import { SectionNav, LEGI_SECTIONS } from '@/components/section-nav'

export const metadata: Metadata = {
  title: 'Cum funcționează Parlamentul',
  description:
    'Drumul unei legi în România: cine o propune, prima cameră și camera decizională, adoptarea tacită, promulgarea, Curtea Constituțională și Monitorul Oficial.',
}

// Static explainer, pictures first. Every rule cites the article of the
// Constitution (revised 2003) so a reader can check it; wording follows the
// site's style rules (no em dashes, plain sentences).

const STEPS = [
  { title: 'Propunerea', lines: ['Guvernul, parlamentari', 'sau 100.000 de cetățeni'] },
  { title: 'Prima cameră', lines: ['45 de zile să voteze'] },
  { title: 'Camera decizională', lines: ['votul final'] },
  { title: 'Președintele', lines: ['20 de zile să promulge'] },
  { title: 'Monitorul Oficial', lines: ['în vigoare după 3 zile'] },
]

// Seats won in December 2024. Majorities below are computed from these.
const DEPUTIES = 331
const SENATORS = 134

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-serif text-[20px] font-normal text-foreground border-b-2 border-sidebar pb-[5px] scroll-mt-20">
      {children}
    </h2>
  )
}
function Art({ n }: { n: string }) {
  return <span className="text-muted whitespace-nowrap">{`(art. ${n})`}</span>
}

/** Desktop: the five steps on one line, with the three detours drawn as arcs. */
function PathDiagram() {
  const x = (i: number) => 68 + i * 134
  const Y = 120
  return (
    <svg viewBox="0 0 672 220" className="hidden sm:block w-full h-auto" role="img"
      aria-label="Drumul unei legi: propunere, prima cameră, camera decizională, Președinte, Monitorul Oficial">
      <defs>
        <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" />
        </marker>
      </defs>

      <line x1={x(0)} y1={Y} x2={x(4)} y2={Y} stroke="var(--text)" strokeWidth="2" />

      {/* tacit: first chamber does not vote in time */}
      <path d={`M${x(1)},${Y - 10} Q${(x(1) + x(2)) / 2},${Y - 70} ${x(2) - 4},${Y - 12}`}
        fill="none" stroke="var(--color-deviation)" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arr)" />
      <text x={(x(1) + x(2)) / 2} y={Y - 74} textAnchor="middle" fontSize="12" fill="var(--color-deviation)">fără vot în termen:</text>
      <text x={(x(1) + x(2)) / 2} y={Y - 60} textAnchor="middle" fontSize="12" fill="var(--color-deviation)">adoptată tacit</text>

      {/* President sends it back once */}
      <path d={`M${x(3)},${Y - 10} Q${(x(2) + x(3)) / 2},${Y - 92} ${x(2) + 4},${Y - 12}`}
        fill="none" stroke="var(--muted)" strokeWidth="1.5" markerEnd="url(#arr)" />
      <text x={(x(2) + x(3)) / 2} y={Y - 74} textAnchor="middle" fontSize="12" fill="var(--muted)">retrimisă o dată</text>

      {/* Constitutional Court, only if someone challenges the law */}
      <circle cx={(x(2) + x(3)) / 2} cy={Y} r="5" fill="var(--bg)" stroke="var(--text)" strokeWidth="1.5" />
      <text x={(x(2) + x(3)) / 2} y={Y + 20} textAnchor="middle" fontSize="11" fill="var(--muted)">CCR, dacă e sesizată</text>

      {STEPS.map((s, i) => (
        <g key={s.title}>
          <circle cx={x(i)} cy={Y} r="9" fill="var(--text)" />
          <text x={x(i)} y={Y + 4} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono, monospace)" fill="var(--bg)">{i + 1}</text>
          <text x={x(i)} y={Y + 44} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text)">{s.title}</text>
          {s.lines.map((l, j) => (
            <text key={l} x={x(i)} y={Y + 62 + j * 16} textAnchor="middle" fontSize="12" fill="var(--muted)">{l}</text>
          ))}
        </g>
      ))}
    </svg>
  )
}

/** Phone: the same path, top to bottom, detours as side notes. */
function PathList() {
  const detour: Record<number, { text: string; color: string }> = {
    1: { text: 'Fără vot în termen: adoptată tacit, merge mai departe.', color: 'var(--color-deviation)' },
    2: { text: 'Curtea Constituțională, dacă e sesizată.', color: 'var(--muted)' },
    3: { text: 'Poate retrimite legea o dată Parlamentului.', color: 'var(--muted)' },
  }
  return (
    <ol className="sm:hidden relative ml-[9px] border-l-2 border-foreground">
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative pl-6 pb-5 last:pb-0">
          <span className="absolute -left-[11px] top-0 h-5 w-5 rounded-full font-mono text-[11px] flex items-center justify-center" style={{ background: "var(--text)", color: "var(--bg)" }}>
            {i + 1}
          </span>
          <div className="text-[15px] font-semibold text-foreground leading-5">{s.title}</div>
          <div className="text-[13px] text-muted">{s.lines.join(' ')}</div>
          {detour[i] && (
            <div className="mt-2 pl-3 border-l-2 border-dashed text-[13px]" style={{ borderColor: detour[i].color, color: detour[i].color }}>
              {detour[i].text}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

/** One square per seat; the first `filled` are ink, `absent` trailing ones are hollow. */
function Seats({ total, filled = total, absent = 0 }: { total: number; filled?: number; absent?: number }) {
  return (
    <div className="flex flex-wrap gap-[2px]" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-[7px] w-[7px]" style={
          i < filled ? { background: 'var(--text)' }
            : i >= total - absent ? { boxShadow: 'inset 0 0 0 1px var(--color-absent)' }
              : { background: 'var(--color-absent)' }
        } />
      ))}
    </div>
  )
}

export default function CumFunctioneazaPage() {
  const present = 250
  return (
    <div className="max-w-2xl space-y-10">
      <SectionNav items={LEGI_SECTIONS} />
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Cum funcționează Parlamentul
        </h1>
        <p className="text-sm text-muted mt-3 leading-relaxed">
          Ce trebuie să știi ca să citești voturile. Trimiterile sunt la articolele din Constituție.
        </p>
      </div>

      <section className="space-y-4">
        <H2 id="drum">Drumul unei legi</H2>
        <PathDiagram />
        <PathList />
        <p className="text-[14px] text-foreground leading-relaxed">
          Domeniul legii decide care cameră votează prima <Art n="75" />. O respingere la prima cameră nu oprește
          legea: contează votul camerei decizionale. Termenele tacite care expiră curând sunt pe{' '}
          <Link href="/tacite" className="text-info hover:underline">Legi tacite</Link>.
        </p>
      </section>

      <section className="space-y-4">
        <H2 id="camere">Două camere</H2>
        <div className="space-y-3">
          <div>
            <div className="text-[13px] text-muted mb-1.5">{`Camera Deputaților · ${DEPUTIES}`}</div>
            <Seats total={DEPUTIES} />
          </div>
          <div>
            <div className="text-[13px] text-muted mb-1.5">{`Senatul · ${SENATORS}`}</div>
            <Seats total={SENATORS} />
          </div>
        </div>
        <p className="text-[14px] text-foreground leading-relaxed">
          Alese pentru patru ani <Art n="63" />. Se votează în sesiuni, februarie–iunie și septembrie–decembrie{' '}
          <Art n="66" />, în rest doar în sesiuni extraordinare.
        </p>
      </section>

      <section className="space-y-4">
        <H2 id="majoritati">Câte voturi trebuie</H2>
        <div className="space-y-4">
          <div>
            <div className="text-[13px] text-foreground mb-1.5">
              {`Lege ordinară: majoritatea celor prezenți. Cu ${present} de deputați în sală, ${Math.floor(present / 2) + 1}.`}
            </div>
            <Seats total={DEPUTIES} filled={Math.floor(present / 2) + 1} absent={DEPUTIES - present} />
          </div>
          <div>
            <div className="text-[13px] text-foreground mb-1.5">
              {`Lege organică: ${Math.floor(DEPUTIES / 2) + 1} din ${DEPUTIES}, oricâți sunt în sală.`}
            </div>
            <Seats total={DEPUTIES} filled={Math.floor(DEPUTIES / 2) + 1} />
          </div>
        </div>
        <p className="text-[14px] text-foreground leading-relaxed">
          Legile organice privesc, de exemplu, alegerile, partidele și organizarea Guvernului <Art n="73, 76" />. La
          ele, o absență cântărește cât un vot împotrivă. Revizuirea Constituției cere două treimi din fiecare cameră
          și un referendum <Art n="151" />.
        </p>
        <div className="flex items-center gap-4 text-[12px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px]" style={{ background: 'var(--text)' }} />voturi necesare</span>
          <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px]" style={{ background: 'var(--color-absent)' }} />restul</span>
          <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px]" style={{ boxShadow: 'inset 0 0 0 1px var(--color-absent)' }} />absenți</span>
        </div>
      </section>

      <section className="space-y-3">
        <H2 id="guvern">Guvernul</H2>
        <ul className="space-y-2 text-[14px] text-foreground leading-relaxed">
          <li>
            Proiectele Guvernului se numesc <em>proiecte de lege</em>, cele ale parlamentarilor <em>propuneri
            legislative</em> <Art n="74" />. Cine propune ce:{' '}
            <Link href="/cine-propune" className="text-info hover:underline">Cine propune</Link>.
          </li>
          <li>
            Ordonanțele de urgență se aplică imediat, iar Parlamentul le aprobă sau le respinge apoi prin lege{' '}
            <Art n="115" />. De aici voturile «pentru aprobarea Ordonanței…».
          </li>
          <li>
            Guvernul se instalează cu vot de încredere <Art n="103" /> și poate fi demis prin moțiune de cenzură{' '}
            <Art n="113" />.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2 id="coduri">Codurile de pe site</H2>
        <dl className="divide-y divide-rim border-y border-rim text-[14px]">
          {[
            ['L123/2026', 'numărul de la Senat. Camera folosește alt număr, PL-x 456/2026, pentru același proiect.'],
            ['PHCD', 'hotărâre a Camerei Deputaților, despre Camera însăși. Nu trece prin Senat.'],
            ['Vot final', 'votul pe tot proiectul. Prezența numără toate voturile, inclusiv amendamentele.'],
          ].map(([k, v]) => (
            <div key={k} className="py-2.5 flex gap-4">
              <dt className="font-mono text-[13px] text-foreground w-[92px] flex-shrink-0">{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] text-muted">
          Cum calculăm prezența și devierile: <Link href="/despre" className="text-info hover:underline">Despre</Link>.
        </p>
      </section>
    </div>
  )
}
