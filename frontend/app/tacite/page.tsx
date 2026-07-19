import Link from 'next/link'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { formatDate, lawSlug } from '@/lib/utils'
import { DeadlineBadge } from '@/components/deadline-badge'
import type { PendingBill } from '@/lib/types'
import { SectionNav, LEGI_SECTIONS } from '@/components/section-nav'

export const revalidate = 600 // ISR — CDN-cache for 10 min
export const metadata: Metadata = {
  title: 'Termene tacite',
  description:
    'Proiecte de lege care trec fără vot dacă prima cameră nu le dezbate la timp — termenele constituționale de adoptare tacită (art. 75).',
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
          Camera Deputaților ca primă cameră, cu termenul constituțional în curs (sursa:{' '}
          <a
            href="https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.termene_camera1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline"
          >
            cdep.ro — verificare termene legale
          </a>
          , actualizat zilnic).
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
                    {/* title links to our own detail page (countdown + context);
                        the official fișa/PDF links stay as secondary sources */}
                    <Link href={`/tacite/${lawSlug(b.code)}`} className="text-foreground hover:underline">
                      {b.title ?? b.code}
                    </Link>
                    {b.summary && (
                      <span className="block text-[12.5px] text-muted mt-1 leading-snug">
                        {b.summary.length > 180 ? b.summary.slice(0, 177).trimEnd() + '…' : b.summary}
                      </span>
                    )}
                    <span className="flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-muted mt-0.5">
                      <span>{b.code} · Camera Deputaților</span>
                      {b.source_url && (
                        <a href={b.source_url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
                          sursa: fișa cdep.ro →
                        </a>
                      )}
                      {b.pdf_url && (
                        <a href={b.pdf_url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
                          PDF proiect →
                        </a>
                      )}
                    </span>
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
