import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { lawSlug, personSlug, formatDate } from '@/lib/utils'

// Both blobs live in scrape_meta: the cabinet (scraper/gov_scraper.py, refreshed
// from a Romanian IP since gov.ro drops the VPS) and the initiator stats
// (scraper/initiator_stats.py, daily), whose «guvern» group is reused here.
export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Guvernul',
  description:
    'Cine face parte din Guvernul României, care miniștri sunt și parlamentari, și ce s-a întâmplat cu proiectele de lege ale Guvernului în această legislatură.',
}

interface Member {
  name: string; role: 'premier' | 'vicepremier' | 'ministru'; function: string
  politician_id: string | null; first_name: string | null; last_name: string | null
  chamber: 'senate' | 'deputies' | null; party: string | null
}
interface Cabinet { source: string; fetched_at: string; members: Member[] }

type Outcome = 'lege' | 'trecuta' | 'respinsa' | 'in_lucru'
interface GovGroup { total: number; out: Partial<Record<Outcome, number>>; laws: { id: string; code: string; t: string; o: Outcome }[] }

// label for 1 / for many
const OUTCOMES: { key: Outcome; label: [string, string]; color: string }[] = [
  { key: 'lege', label: ['a devenit lege', 'au devenit lege'], color: 'var(--color-for-dark)' },
  { key: 'trecuta', label: ['trecut de Parlament', 'trecute de Parlament'], color: 'var(--color-for)' },
  { key: 'respinsa', label: ['respins', 'respinse'], color: 'var(--color-against-dark)' },
  { key: 'in_lucru', label: ['încă în lucru', 'încă în lucru'], color: '#C3C8CF' },
]
const CHIP: Record<Outcome, string> = { lege: 'Lege', trecuta: 'Trecută de Parlament', respinsa: 'Respinsă', in_lucru: 'În lucru' }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

function parse<T>(v: string | null | undefined): T | null {
  try { return v ? (JSON.parse(v) as T) : null } catch { return null }
}

export default async function GuvernPage() {
  const { data } = await getDB().from('scrape_meta').select('key, value').in('key', ['cabinet', 'initiator_stats'])
  const cabinet = parse<Cabinet>(data?.find(r => r.key === 'cabinet')?.value)
  const stats = parse<{ groups: ({ key: string } & GovGroup)[] }>(data?.find(r => r.key === 'initiator_stats')?.value)
  const gov = stats?.groups.find(g => g.key === 'guvern') ?? null
  const members = cabinet?.members ?? []
  const mps = members.filter(m => m.politician_id).length

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Guvernul
        </h1>
        <p className="text-sm text-muted mt-3 max-w-2xl leading-relaxed">
          Guvernul propune proiecte de lege și emite ordonanțe, pe care Parlamentul le aprobă sau le respinge.
          Miniștrii care sunt și parlamentari nu votează în plen cât timp sunt în Guvern, așa că absențele lor din
          acea perioadă nu intră în clasamente.
        </p>
      </div>

      <section className="max-w-3xl">
        <div className="flex items-baseline justify-between gap-3 border-b-2 border-sidebar pb-[5px] mb-1">
          <h2 className="font-serif text-[20px] font-normal text-foreground">Cabinetul</h2>
          {members.length > 0 && (
            <span className="text-[12px] text-muted">{`${members.length} membri · ${mps} sunt parlamentari`}</span>
          )}
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-muted py-4">Lista nu e disponibilă acum. Revino mai târziu.</p>
        ) : (
          <ul className="divide-y divide-rim">
            {members.map(m => {
              const href = m.politician_id && m.first_name && m.last_name
                ? `/${m.chamber === 'senate' ? 'senatori' : 'deputati'}/${personSlug(m.first_name, m.last_name)}`
                : null
              return (
                <li key={m.name} className="py-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium text-foreground">
                      {href ? <Link href={href} className="hover:underline">{m.name}</Link> : m.name}
                    </div>
                    <div className="text-[13px] text-muted">{cap(m.function)}</div>
                  </div>
                  <div className="text-[12px] text-muted whitespace-nowrap">
                    {href
                      ? `${m.chamber === 'senate' ? 'senator' : 'deputat'}${m.party ? ` ${m.party}` : ''}`
                      : 'nu e parlamentar'}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {cabinet && (
          <p className="mt-3 text-[12px] text-muted">
            {'Sursa: '}
            <a href={cabinet.source} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">gov.ro</a>
            {`, verificat pe ${formatDate(cabinet.fetched_at.slice(0, 10))}. Partidul apare doar la miniștrii care sunt parlamentari: gov.ro nu publică afilierea politică.`}
          </p>
        )}
      </section>

      {gov && (
        <section className="max-w-3xl space-y-4">
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-sidebar pb-[5px]">
            <h2 className="font-serif text-[20px] font-normal text-foreground">Ce a propus Guvernul</h2>
            <Link href="/cine-propune" className="text-[11px] text-muted hover:text-foreground transition-colors">Comparat cu partidele</Link>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[40px] leading-none text-foreground">{pct(gov.out.lege ?? 0, gov.total)}%</span>
              <span className="text-sm text-muted">au devenit lege</span>
            </div>
            <div className="mt-4 flex h-2.5 w-full overflow-hidden bg-raised" aria-hidden>
              {OUTCOMES.map(o => (gov.out[o.key] ?? 0) > 0 && (
                <div key={o.key} style={{ width: `${((gov.out[o.key] ?? 0) / gov.total) * 100}%`, background: o.color }} />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted">
              {OUTCOMES.map(o => {
                const n = gov.out[o.key] ?? 0
                return (
                  <li key={o.key} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 flex-shrink-0" style={{ background: o.color }} />
                    <span className="font-mono text-foreground">{n}</span>
                    {o.label[n === 1 ? 0 : 1]}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-[12px] text-muted">
              {`Din ${gov.total} de proiecte ale Guvernului, din toată legislatura 2024–2028, nu doar ale cabinetului de acum.`}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-muted mb-2">Cele mai recente</h3>
            <ul className="space-y-2">
              {gov.laws.slice(0, 10).map(l => (
                <li key={l.id} className="flex items-baseline gap-3 text-[14px]">
                  <span className="font-mono text-[12px] text-muted w-[86px] flex-shrink-0">{l.code}</span>
                  <Link href={`/legi/${lawSlug(l.code)}`} className="flex-1 min-w-0 text-foreground hover:underline">{l.t}</Link>
                  <span className="text-[11px] whitespace-nowrap" style={{ color: l.o === 'in_lucru' ? 'var(--muted)' : OUTCOMES.find(o => o.key === l.o)?.color }}>
                    {CHIP[l.o]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
