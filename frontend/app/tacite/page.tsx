import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, countNoun } from '@/lib/utils'
import type { PendingBill } from '@/lib/types'
import { SectionNav, LEGI_SECTIONS } from '@/components/section-nav'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Termene tacite',
  description:
    'Proiecte de lege care trec fără vot dacă prima cameră nu le dezbate la timp — termenele constituționale de adoptare tacită (art. 75).',
}

function daysLeft(deadline: string): number {
  const ms = new Date(deadline + 'T23:59:59+03:00').getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const d = daysLeft(deadline)
  if (d < 0) {
    return (
      <span className="inline-flex text-[11px] font-bold uppercase tracking-wide rounded px-2 py-0.5 bg-raised text-muted">
        termen depășit
      </span>
    )
  }
  const urgent = d <= 10
  return (
    <span
      className="inline-flex text-[11px] font-bold uppercase tracking-wide rounded px-2 py-0.5 text-white"
      style={{ backgroundColor: urgent ? 'var(--color-against)' : 'var(--sidebar-bg)' }}
    >
      {d === 0 ? 'azi' : `${d} ${countNoun(d, 'zi', 'zile')}`}
    </span>
  )
}

export default async function TacitePage() {
  const { data } = await getDB()
    .from('pending_bills')
    .select('*')
    .order('tacit_deadline', { ascending: true })
  const bills = (data as PendingBill[] | null) ?? []

  return (
    <div className="space-y-6">
      <SectionNav items={LEGI_SECTIONS} />
      <div>
        <h1 className="font-serif text-[30px] sm:text-[40px] font-normal tracking-[-0.01em] leading-[1.05] text-foreground">
          Termene tacite
        </h1>
        <p className="text-sm text-muted mt-3 max-w-2xl">
          Constituția (art. 75) dă primei camere sesizate 45 de zile să se pronunțe asupra
          unui proiect de lege — 60 pentru coduri și legi complexe. Dacă termenul expiră fără
          vot, proiectul e <strong className="text-foreground">considerat adoptat, fără ca cineva să fi votat</strong>,
          și merge mai departe la camera decizională. Mai jos: proiectele înregistrate la
          Camera Deputaților ca primă cameră, cu termenul constituțional în curs
          (sursa: cdep.ro, actualizat zilnic).
        </p>
      </div>

      {!bills.length ? (
        <p className="text-sm text-muted py-8">
          Niciun proiect cu termen constituțional în curs — lista se actualizează zilnic.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b-2 border-sidebar text-[11px] uppercase tracking-[0.14em] text-faint">
                <th className="text-left py-3 pr-4 font-medium">Expiră</th>
                <th className="text-left py-3 pr-4 font-medium">Proiect</th>
                <th className="text-left py-3 pr-4 font-medium hidden md:table-cell">Termen</th>
                <th className="text-left py-3 pr-4 font-medium hidden lg:table-cell">Comisie</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(b => (
                <tr key={b.id} className="border-b border-rim hover:bg-raised transition-colors">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {b.tacit_deadline && (
                      <>
                        <DeadlineBadge deadline={b.tacit_deadline} />
                        <span className="block text-[11px] text-muted mt-1">{formatDate(b.tacit_deadline)}</span>
                      </>
                    )}
                  </td>
                  <td className="py-3 pr-4 max-w-xl">
                    <a
                      href={b.source_url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:underline"
                    >
                      {b.title ?? b.code}
                    </a>
                    <span className="block font-mono text-[11px] text-muted mt-0.5">{b.code} · Camera Deputaților</span>
                  </td>
                  <td className="py-3 pr-4 text-muted text-sm hidden md:table-cell whitespace-nowrap">
                    {b.term_days ?? '—'}
                  </td>
                  <td className="py-3 pr-4 text-muted text-sm hidden lg:table-cell max-w-xs">
                    {b.committee ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-faint max-w-2xl">
        Termenul curge de la prezentarea în Biroul permanent și se suspendă în vacanțele
        parlamentare; datele de mai sus sunt termenele oficiale publicate de Camera Deputaților.
        Proiectele cu Senatul ca primă cameră nu au o listă publică echivalentă.
      </p>
    </div>
  )
}
