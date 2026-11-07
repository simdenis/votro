import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { lawSlug } from '@/lib/utils'
import { SectionNav, LEGI_SECTIONS } from '@/components/section-nav'

// Precomputed daily by scraper/initiator_stats.py into scrape_meta: one row,
// because aggregating ~24k initiator rows per render would blow the Worker's
// CPU cap.
export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Cine propune legile',
  description:
    'Proiectele votate în plen în această legislatură, după cine le-a inițiat: Guvernul sau parlamentarii fiecărui partid, și câte au devenit lege.',
}

type Outcome = 'lege' | 'trecuta' | 'respinsa' | 'in_lucru'
interface LawRow { id: string; code: string; t: string; o: Outcome; solo: boolean }
interface Group {
  key: string; label: string; name: string; total: number; solo: number
  out: Partial<Record<Outcome, number>>; laws: LawRow[]
}
interface Stats {
  generated_at: string; laws: number; by_type: Record<string, number>
  parlamentari_out: Partial<Record<Outcome, number>>
  unmatched_signatures: number; signatures: number; groups: Group[]
}

const OUTCOMES: { key: Outcome; label: string; color: string }[] = [
  { key: 'lege', label: 'au devenit lege', color: 'var(--color-for-dark)' },
  { key: 'trecuta', label: 'trecute de Parlament', color: 'var(--color-for)' },
  { key: 'respinsa', label: 'respinse', color: 'var(--color-against-dark)' },
  { key: 'in_lucru', label: 'încă în lucru', color: '#C3C8CF' },
]
const CHIP: Record<Outcome, string> = { lege: 'Lege', trecuta: 'Trecută de Parlament', respinsa: 'Respinsă', in_lucru: 'În lucru' }

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

function Bar({ out, total }: { out: Group['out']; total: number }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-raised" aria-hidden>
      {OUTCOMES.map(o => (out[o.key] ?? 0) > 0 && (
        <div key={o.key} style={{ width: `${((out[o.key] ?? 0) / total) * 100}%`, background: o.color }} />
      ))}
    </div>
  )
}

export default async function CinePropunePage() {
  const { data } = await getDB().from('scrape_meta').select('value').eq('key', 'initiator_stats').maybeSingle()
  let stats: Stats | null = null
  try { stats = data?.value ? (JSON.parse(data.value) as Stats) : null } catch { stats = null }

  const gov = stats?.groups.find(g => g.key === 'guvern')
  const parties = stats?.groups.filter(g => g.key !== 'guvern') ?? []
  const parl = stats?.parlamentari_out ?? {}
  const parlTotal = stats?.by_type.parlamentari ?? 0

  return (
    <div className="space-y-8">
      <SectionNav items={LEGI_SECTIONS} />
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Cine propune legile
        </h1>
        <p className="text-sm text-muted mt-3 max-w-2xl leading-relaxed">
          Legile pot fi propuse de Guvern (se numesc <em>proiecte de lege</em>), de deputați și senatori
          (<em>propuneri legislative</em>) sau de cel puțin 100.000 de cetățeni (art. 74 din Constituție).
          Mai jos sunt proiectele votate în plen în această legislatură, după cine le-a semnat, și ce s-a
          întâmplat cu ele. Cum ajunge un proiect lege e explicat pe{' '}
          <Link href="/cum-functioneaza" className="text-info hover:underline">Cum funcționează Parlamentul</Link>.
        </p>
      </div>

      {!stats ? (
        <p className="text-sm text-muted">Datele nu sunt disponibile acum. Revino mai târziu.</p>
      ) : (
        <>
          <section className="grid sm:grid-cols-2 gap-3 max-w-3xl">
            {[
              { title: 'Guvernul', total: gov?.total ?? 0, out: gov?.out ?? {} },
              { title: 'Parlamentarii', total: parlTotal, out: parl },
            ].map(c => (
              <div key={c.title} className="border-t border-rim py-5">
                <div className="text-[11px] font-semibold text-muted">{c.title}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-[40px] leading-none text-foreground">{pct(c.out.lege ?? 0, c.total)}%</span>
                  <span className="text-sm text-muted">au devenit lege</span>
                </div>
                <p className="mt-2 text-[13px] text-muted">
                  {`${c.out.lege ?? 0} din ${c.total} proiecte votate · ${c.out.respinsa ?? 0} respinse · ${c.out.in_lucru ?? 0} încă în lucru`}
                </p>
                <div className="mt-3"><Bar out={c.out} total={c.total} /></div>
              </div>
            ))}
          </section>

          <section className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-muted">
              {OUTCOMES.map(o => (
                <span key={o.key} className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: o.color }} />{o.label}
                </span>
              ))}
            </div>
            <h2 className="font-serif text-[20px] font-normal text-foreground border-b-2 border-sidebar pb-[5px] pt-2">Pe partide</h2>
            <ul className="divide-y divide-rim border-y border-rim">
              {parties.map(g => (
                <li key={g.key}>
                  <details className="group py-3.5">
                    <summary className="cursor-pointer list-none select-none">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground">{g.label}</span>
                          <span className="text-[13px] text-muted">{` · ${g.total} proiecte semnate, ${g.solo} doar de parlamentari ${g.label}`}</span>
                        </div>
                        <div className="text-[13px] text-foreground whitespace-nowrap">
                          {`${pct(g.out.lege ?? 0, g.total)}% lege`}
                        </div>
                      </div>
                      <div className="mt-2"><Bar out={g.out} total={g.total} /></div>
                      <div className="mt-1.5 text-[12px] text-muted group-open:hidden">Vezi proiectele</div>
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {g.laws.map(l => (
                        <li key={l.id} className="flex items-baseline gap-3 text-[14px]">
                          <span className="font-mono text-[12px] text-muted w-[86px] flex-shrink-0">{l.code}</span>
                          <Link href={`/legi/${lawSlug(l.code)}`} className="flex-1 min-w-0 text-foreground hover:underline">{l.t}</Link>
                          <span className="text-[11px] whitespace-nowrap" style={{ color: l.o === 'in_lucru' ? 'var(--muted)' : OUTCOMES.find(o => o.key === l.o)?.color }}>
                            {CHIP[l.o]}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {g.total > g.laws.length && (
                      <p className="mt-2 text-[12px] text-muted">{`Cele mai recente ${g.laws.length} din ${g.total}.`}</p>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2 max-w-2xl text-[13px] text-muted leading-relaxed">
            <h2 className="font-serif text-[20px] font-normal text-foreground border-b-2 border-sidebar pb-[5px]">Cum citești cifrele</h2>
            <p>
              Un proiect semnat de parlamentari din mai multe partide apare la fiecare dintre ele, așa că
              rândurile partidelor nu se adună. «Doar de parlamentari» înseamnă că toți semnatarii identificați
              sunt din acel partid.
            </p>
            <p>
              Partidul e cel de acum al fiecărui semnatar (afilierea curentă), ca peste tot pe site. Un proiect
              semnat înainte ca cineva să-și schimbe partidul apare la partidul nou.
            </p>
            <p>
              Numărul de proiecte arată cât de activ inițiază un partid, nu cât de bune sunt proiectele. Partidele
              mari au mai mulți semnatari, deci și mai multe proiecte.
            </p>
            <p>
              {`Sursa: fișele proiectelor de pe senat.ro, actualizate zilnic. ${stats.unmatched_signatures.toLocaleString('ro-RO')} din ${stats.signatures.toLocaleString('ro-RO')} de semnături nu au putut fi legate de un parlamentar din baza noastră (de obicei foști parlamentari) și nu sunt atribuite unui partid.`}
            </p>
          </section>
        </>
      )}
    </div>
  )
}
